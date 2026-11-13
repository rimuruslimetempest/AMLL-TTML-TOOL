import {
	ArrowLeft20Regular,
	DismissRegular,
	Key20Regular,
	MusicNote1Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Checkbox,
	Dialog,
	IconButton,
	ScrollArea,
	Spinner,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	GeniusApi,
	GeniusResolver,
	isGeniusSongUrl,
} from "$/modules/genius/api/client";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import { geniusApiKeyAtom } from "$/modules/settings/states";
import { geniusLyricsRefreshDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLMetadata } from "$/types/ttml";
import { getGeniusKeyGuideUrl } from "$/utils/genius-guide";
import { openExternal } from "$/utils/openExternal";
import { msToTimestamp } from "$/utils/timestamp";
import { getBetterGeniusCoverArt } from "../utils/image";
import {
	applyGeniusRefreshPlan,
	buildGeniusRefreshPlan,
	extractGeniusLyricLines,
	type GeniusRefreshEntry,
} from "../utils/lyrics-refresh";
import styles from "./GeniusLyricsRefreshDialog.module.css";

interface GeniusRefreshHit {
	id: number;
	title: string;
	artist: string;
	album?: string;
	cover?: string;
	url?: string;
}

const META_TITLE_KEYS = ["musicname", "title", "trackname"];
const META_ARTIST_KEYS = ["artists", "artist", "author"];
const COVER_KEYS = new Set([
	"cover",
	"cover_art",
	"artwork",
	"image",
	"album_art",
]);

const findMetaValue = (metadata: TTMLMetadata[], keys: string[]) => {
	for (const key of keys) {
		const entry = metadata.find(
			(item) => item.key.toLowerCase() === key.toLowerCase(),
		);
		const value = entry?.value[0]?.trim();
		if (value) return value;
	}
	return "";
};

const findDirectGeniusUrl = (metadata: TTMLMetadata[]): string | null => {
	for (const entry of metadata) {
		if (COVER_KEYS.has(entry.key.toLowerCase())) continue;
		for (const rawValue of entry.value) {
			const value = rawValue.trim();
			if (!isGeniusSongUrl(value)) continue;
			if (/^genius:\/\/songs\/(\d+)/i.test(value)) {
				const id = value.match(/^genius:\/\/songs\/(\d+)/i)?.[1];
				return id ? `https://genius.com/songs/${id}` : null;
			}
			return /^https?:\/\//i.test(value) ? value : `https://${value}`;
		}
	}
	return null;
};

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const getEntryStatusClass = (status: GeniusRefreshEntry["status"]) => {
	switch (status) {
		case "unchanged":
			return styles.statusUnchanged;
		case "changed":
			return styles.statusChanged;
		case "added":
			return styles.statusAdded;
		case "removed":
			return styles.statusRemoved;
	}
};

const getCoverUrl = (hit: GeniusRefreshHit) =>
	getBetterGeniusCoverArt(hit.cover, 100);

export const GeniusLyricsRefreshDialog = () => {
	const { t, i18n } = useTranslation();
	const store = useStore();
	const [isOpen, setIsOpen] = useAtom(geniusLyricsRefreshDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const { config: segmentationConfig } = useSegmentationConfig();

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeniusRefreshHit[]>([]);
	const [selectedHit, setSelectedHit] = useState<GeniusRefreshHit | null>(null);
	const [rawLyrics, setRawLyrics] = useState("");
	const [searching, setSearching] = useState(false);
	const [loadingLyrics, setLoadingLyrics] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [includeStructuralChanges, setIncludeStructuralChanges] =
		useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tempApiKey, setTempApiKey] = useState("");
	const requestIdRef = useRef(0);
	const searchRequestIdRef = useRef(0);

	const initialQuery = useCallback(() => {
		const directUrl = findDirectGeniusUrl(lyricLines.metadata);
		if (directUrl) return directUrl;
		const title = findMetaValue(lyricLines.metadata, META_TITLE_KEYS);
		const artist = findMetaValue(lyricLines.metadata, META_ARTIST_KEYS);
		return [artist, title].filter(Boolean).join(" ").trim();
	}, [lyricLines.metadata]);

	const loadLyrics = useCallback(
		async (hit: GeniusRefreshHit) => {
			const requestId = ++requestIdRef.current;
			setSelectedHit(hit);
			setRawLyrics("");
			setLoadingLyrics(true);
			setIncludeStructuralChanges(false);
			setError(null);
			try {
				const lyrics = await GeniusApi.getLyrics(hit.id);
				if (requestId !== requestIdRef.current) return;
				if (extractGeniusLyricLines(lyrics).length === 0) {
					throw new Error(
						t("genius.refresh.noLines", "This song has no lyric lines."),
					);
				}
				setRawLyrics(lyrics);
			} catch (loadError) {
				if (requestId !== requestIdRef.current) return;
				setError(
					t(
						"genius.refresh.loadFailed",
						"Could not load Genius lyrics: {error}",
						{
							error: getErrorMessage(loadError),
						},
					),
				);
				setSelectedHit(null);
				setRawLyrics("");
			} finally {
				if (requestId === requestIdRef.current) setLoadingLyrics(false);
			}
		},
		[t],
	);

	const runSearch = useCallback(
		async (rawQuery: string) => {
			const normalizedQuery = rawQuery.trim();
			if (!normalizedQuery) return;
			const searchId = ++searchRequestIdRef.current;
			setSearching(true);
			setHasSearched(true);
			setResults([]);
			setSelectedHit(null);
			setRawLyrics("");
			setError(null);
			try {
				const hits: GeniusRefreshHit[] = [];
				if (isGeniusSongUrl(normalizedQuery)) {
					const resolved = await GeniusResolver.resolveSong(
						normalizedQuery,
						geniusApiKey,
					);
					if (searchId !== searchRequestIdRef.current) return;
					if (!resolved || !Number.isFinite(resolved.id)) {
						throw new Error(
							t(
								"genius.refresh.songNotFound",
								"That Genius song could not be found.",
							),
						);
					}
					hits.push({
						id: resolved.id,
						title: resolved.title,
						artist: resolved.artist,
						album: resolved.album,
						cover: resolved.cover,
						url: resolved.url,
					});
				} else {
					if (!geniusApiKey) {
						throw new Error(
							t(
								"genius.refresh.tokenRequired",
								"Add a Genius token below, or paste a direct Genius song link.",
							),
						);
					}
					const data = await GeniusApi.search(normalizedQuery, geniusApiKey, {
						enrichAlbums: false,
					});
					if (searchId !== searchRequestIdRef.current) return;
					for (const { result } of data.response.hits) {
						hits.push({
							id: result.id,
							title: result.title,
							artist:
								result.primary_artist?.name ||
								result.artist_names ||
								"Unknown artist",
							album: result.album?.name,
							cover:
								result.song_art_image_url ||
								result.song_art_image_thumbnail_url,
							url: result.url,
						});
					}
				}
				setResults(hits);
				// When there is more than one result, let the user pick instead
				// of silently comparing against an unrelated version.
				if (hits.length === 1) await loadLyrics(hits[0]);
			} catch (searchError) {
				if (searchId !== searchRequestIdRef.current) return;
				setError(
					t("genius.refresh.searchFailed", "Genius search failed: {error}", {
						error: getErrorMessage(searchError),
					}),
				);
			} finally {
				if (searchId === searchRequestIdRef.current) setSearching(false);
			}
		},
		[geniusApiKey, loadLyrics, t],
	);

	useEffect(() => {
		if (!isOpen) return;
		searchRequestIdRef.current++;
		requestIdRef.current++;
		const initial = initialQuery();
		setQuery(initial);
		setResults([]);
		setSelectedHit(null);
		setRawLyrics("");
		setHasSearched(false);
		setIncludeStructuralChanges(false);
		setError(null);
		setTempApiKey("");
		setSearching(false);
		setLoadingLyrics(false);
		if (!initial || (!geniusApiKey && !isGeniusSongUrl(initial))) return;
		const timeout = window.setTimeout(() => {
			void runSearch(initial);
		}, 80);
		return () => window.clearTimeout(timeout);
	}, [isOpen, initialQuery, runSearch, geniusApiKey]);

	useEffect(() => {
		if (isOpen) return;
		searchRequestIdRef.current++;
		requestIdRef.current++;
	}, [isOpen]);

	const plan = useMemo(
		() => (rawLyrics ? buildGeniusRefreshPlan(lyricLines, rawLyrics) : null),
		[lyricLines, rawLyrics],
	);

	const structuralChangeCount = plan ? plan.addedCount + plan.removedCount : 0;
	const canApply = Boolean(
		plan &&
			(plan.changedCount > 0 ||
				(includeStructuralChanges && structuralChangeCount > 0)),
	);

	const handleBack = useCallback(() => {
		requestIdRef.current++;
		searchRequestIdRef.current++;
		setSelectedHit(null);
		setRawLyrics("");
		setLoadingLyrics(false);
		setError(null);
		setIncludeStructuralChanges(false);
	}, []);

	const handleApply = useCallback(() => {
		if (!rawLyrics) return;
		const current = store.get(lyricLinesAtom);
		const currentPlan = buildGeniusRefreshPlan(current, rawLyrics);
		const result = applyGeniusRefreshPlan(current, currentPlan, {
			includeStructuralChanges,
			segmentationConfig,
		});
		if (
			result.changedCount === 0 &&
			result.addedCount === 0 &&
			result.removedCount === 0
		) {
			toast.info(
				t(
					"genius.refresh.noChanges",
					"Your lyrics already match this Genius page.",
				),
			);
			return;
		}

		setLyricLines((draft) => {
			draft.lyricLines = result.lyrics.lyricLines;
		});
		if (result.addedCount > 0 || result.removedCount > 0) {
			toast.success(
				t(
					"genius.refresh.appliedWithStructure",
					"Updated {changed} lines, added {added} untimed lines, and removed {removed} lines.",
					{
						changed: result.changedCount,
						added: result.addedCount,
						removed: result.removedCount,
					},
				),
			);
		} else {
			toast.success(
				t(
					"genius.refresh.applied",
					"Updated {count} lyric lines from Genius. Timestamps preserved.",
					{ count: result.changedCount },
				),
			);
		}
		setIsOpen(false);
	}, [
		includeStructuralChanges,
		rawLyrics,
		segmentationConfig,
		setIsOpen,
		setLyricLines,
		store,
		t,
	]);

	const getEntryLabel = (entry: GeniusRefreshEntry) => {
		switch (entry.status) {
			case "unchanged":
				return t("genius.refresh.matching", "Already matching");
			case "changed":
				return t("genius.refresh.changed", "Lyrics changed");
			case "added":
				return t("genius.refresh.added", "New on Genius");
			case "removed":
				return t("genius.refresh.removed", "Not on Genius");
		}
	};

	const renderEntry = (entry: GeniusRefreshEntry, index: number) => {
		const oldLine =
			entry.oldIndex !== null
				? lyricLines.lyricLines[entry.oldIndex]
				: undefined;
		const applied =
			entry.status === "changed" ||
			entry.status === "unchanged" ||
			includeStructuralChanges;
		const timestamp =
			oldLine && oldLine.endTime > oldLine.startTime
				? `${msToTimestamp(oldLine.startTime)} – ${msToTimestamp(oldLine.endTime)}`
				: t("genius.refresh.untimed", "Needs timing");
		const statusClass = getEntryStatusClass(entry.status);

		return (
			<div
				className={`${styles.entry} ${applied ? "" : styles.entryPending}`}
				data-status={entry.status}
				key={`${entry.oldIndex ?? "new"}-${entry.newIndex ?? "old"}-${index}`}
			>
				<div className={styles.entryMeta}>
					<span className={`${styles.statusLabel} ${statusClass}`}>
						{getEntryLabel(entry)}
					</span>
					<span className={styles.timestamp}>
						{entry.status === "added"
							? t("genius.refresh.untimed", "Needs timing")
							: timestamp}
					</span>
				</div>
				<div className={styles.entryText}>
					{entry.status !== "added" && entry.oldText && (
						<span
							className={
								entry.status === "unchanged"
									? styles.currentText
									: styles.oldText
							}
						>
							{entry.oldText}
						</span>
					)}
					{entry.status !== "removed" &&
						entry.status !== "unchanged" &&
						entry.newText && (
							<span className={styles.newText}>{entry.newText}</span>
						)}
				</div>
			</div>
		);
	};

	const renderResultCover = (hit: GeniusRefreshHit) => {
		const cover = getCoverUrl(hit);
		return cover ? (
			<img
				className={styles.cover}
				src={cover}
				alt=""
				loading="lazy"
				referrerPolicy="no-referrer"
			/>
		) : (
			<span className={styles.coverFallback}>
				<MusicNote1Regular style={{ width: 18, height: 18 }} />
			</span>
		);
	};

	const renderSelectedCover = () => {
		const cover = selectedHit ? getCoverUrl(selectedHit) : "";
		return cover ? (
			<img
				className={styles.selectedCover}
				src={cover}
				alt=""
				loading="lazy"
				referrerPolicy="no-referrer"
			/>
		) : (
			<span className={styles.selectedCoverFallback}>
				<MusicNote1Regular style={{ width: 18, height: 18 }} />
			</span>
		);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				aria-describedby={undefined}
				className={styles.dialog}
				style={{ padding: 0 }}
			>
				<header className={styles.header}>
					<div className={styles.headerMain}>
						<span className={styles.dialogIcon}>
							<MusicNote1Regular style={{ width: 18, height: 18 }} />
						</span>
						<div className={styles.titleBlock}>
							<Dialog.Title className={styles.title}>
								{t("genius.refresh.title", "Refresh Lyrics from Genius")}
							</Dialog.Title>
							<Dialog.Description className={styles.description}>
								{t(
									"genius.refresh.description",
									"Compare with Genius and update the words without moving line timestamps.",
								)}
							</Dialog.Description>
						</div>
					</div>
					<Dialog.Close asChild>
						<IconButton
							className={styles.closeButton}
							variant="ghost"
							color="gray"
							size="2"
							aria-label={t("common.close", "Close")}
						>
							<DismissRegular />
						</IconButton>
					</Dialog.Close>
				</header>

				{!selectedHit ? (
					<div className={styles.body}>
						<div className={styles.searchRow}>
							<TextField.Root
								className={styles.searchField}
								size="2"
								placeholder={t(
									"genius.refresh.searchPlaceholder",
									"Artist – Song title or Genius URL…",
								)}
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !searching) {
										void runSearch(query);
									}
								}}
							>
								<TextField.Slot>
									<Search16Regular />
								</TextField.Slot>
							</TextField.Root>
							<Button
								size="2"
								onClick={() => void runSearch(query)}
								disabled={searching || !query.trim()}
							>
								{searching ? <Spinner /> : t("common.search", "Search")}
							</Button>
						</div>

						{!geniusApiKey && !isGeniusSongUrl(query.trim()) && (
							<div className={styles.setupPanel}>
								<div className={styles.setupHeader}>
									<Key20Regular />
									<span className={styles.setupTitle}>
										{t(
											"genius.refresh.tokenSetupTitle",
											"Genius token needed to search",
										)}
									</span>
								</div>
								<p className={styles.setupDescription}>
									{t(
										"genius.refresh.tokenSetup",
										"Add a CLIENT ACCESS TOKEN, or paste a direct Genius song link above.",
									)}
								</p>
								<div className={styles.setupInputRow}>
									<TextField.Root
										className={styles.setupInput}
										size="2"
										placeholder={t(
											"genius.refresh.tokenPlaceholder",
											"Paste CLIENT ACCESS TOKEN",
										)}
										value={tempApiKey}
										onChange={(event) => setTempApiKey(event.target.value)}
									/>
									<Button
										variant="soft"
										size="2"
										disabled={!tempApiKey.trim()}
										onClick={() => {
											setGeniusApiKey(tempApiKey.trim());
											setTempApiKey("");
										}}
									>
										{t("genius.refresh.saveToken", "Save token")}
									</Button>
								</div>
								<Button
									className={styles.setupGuide}
									variant="ghost"
									size="1"
									onClick={() =>
										void openExternal(
											getGeniusKeyGuideUrl(i18n.resolvedLanguage),
										)
									}
								>
									{t(
										"genius.refresh.howToGetToken",
										"How to create a Genius token",
									)}
								</Button>
							</div>
						)}

						{error && <div className={styles.errorPanel}>{error}</div>}

						<ScrollArea
							className={styles.scroll}
							type="auto"
							scrollbars="vertical"
						>
							{searching ? (
								<div className={styles.loadingState}>
									<Spinner size="3" />
									<span>
										{t("genius.refresh.searching", "Searching Genius…")}
									</span>
								</div>
							) : results.length > 0 ? (
								<>
									{results.length > 1 && (
										<div className={styles.listHeading}>
											{t(
												"genius.refresh.chooseResult",
												"Choose the correct Genius page",
											)}
										</div>
									)}
									<div className={styles.resultList}>
										{results.map((hit) => (
											<button
												className={styles.resultRow}
												key={hit.id}
												type="button"
												onClick={() => void loadLyrics(hit)}
											>
												{renderResultCover(hit)}
												<div className={styles.resultText}>
													<span className={styles.resultTitle}>
														{hit.title}
													</span>
													<span className={styles.resultMeta}>
														{hit.artist}
														{hit.album ? ` · ${hit.album}` : ""}
													</span>
												</div>
												<span
													className={styles.resultAction}
													aria-hidden="true"
												>
													›
												</span>
											</button>
										))}
									</div>
								</>
							) : hasSearched && !error ? (
								<div className={styles.emptyState}>
									<span className={styles.emptyIcon}>
										<Search16Regular />
									</span>
									<span className={styles.emptyTitle}>
										{t("genius.refresh.noResultsTitle", "No matches found")}
									</span>
									<span className={styles.emptyText}>
										{t(
											"genius.refresh.noResults",
											"No songs found. Try another search or paste a Genius link.",
										)}
									</span>
								</div>
							) : (
								<div className={styles.emptyState}>
									<span className={styles.emptyIcon}>
										<Search16Regular />
									</span>
									<span className={styles.emptyText}>
										{t(
											"genius.refresh.searchPrompt",
											"Search for the song to refresh from Genius.",
										)}
									</span>
								</div>
							)}
						</ScrollArea>
					</div>
				) : (
					<div className={styles.body}>
						<div className={styles.backRow}>
							<Button
								variant="ghost"
								size="1"
								color="gray"
								onClick={handleBack}
							>
								<ArrowLeft20Regular style={{ width: 14, height: 14 }} />
								{t("genius.refresh.backToResults", "Back to results")}
							</Button>
						</div>

						<div className={styles.selectedHeader}>
							{renderSelectedCover()}
							<div className={styles.selectedText}>
								<span className={styles.selectedTitle}>
									{selectedHit.title}
								</span>
								<span className={styles.selectedMeta}>
									{selectedHit.artist}
									{selectedHit.album ? ` · ${selectedHit.album}` : ""}
								</span>
							</div>
							<span className={styles.pageTag}>
								<span className={styles.pageTagDot} />
								{t("genius.refresh.currentGeniusPage", "Current Genius page")}
							</span>
						</div>

						{error && <div className={styles.errorPanel}>{error}</div>}

						{loadingLyrics ? (
							<div className={styles.loadingState}>
								<Spinner size="3" />
								<span>
									{t(
										"genius.refresh.loadingLyrics",
										"Fetching current Genius lyrics…",
									)}
								</span>
							</div>
						) : plan ? (
							<>
								<div className={styles.summary}>
									<div className={styles.stats}>
										<span className={styles.stat}>
											<span className={`${styles.dot} ${styles.dotChanged}`} />
											{t("genius.refresh.changedCount", "{count} changed", {
												count: plan.changedCount,
											})}
										</span>
										<span className={styles.stat}>
											<span
												className={`${styles.dot} ${styles.dotUnchanged}`}
											/>
											{t("genius.refresh.matchingCount", "{count} matching", {
												count: plan.unchangedCount,
											})}
										</span>
										<span className={styles.stat}>
											<span className={`${styles.dot} ${styles.dotAdded}`} />
											{t("genius.refresh.addedCount", "{count} new", {
												count: plan.addedCount,
											})}
										</span>
										<span className={styles.stat}>
											<span className={`${styles.dot} ${styles.dotRemoved}`} />
											{t("genius.refresh.removedCount", "{count} removed", {
												count: plan.removedCount,
											})}
										</span>
									</div>
									<span className={styles.timingNote}>
										{t(
											"genius.refresh.safeMatching",
											"Only clearly matching lines are updated. Major rewrites appear as new or removed lines.",
										)}
									</span>
								</div>

								{structuralChangeCount > 0 && (
									<div className={styles.structurePanel}>
										<Checkbox
											id="genius-refresh-structural"
											checked={includeStructuralChanges}
											onCheckedChange={(checked) =>
												setIncludeStructuralChanges(checked === true)
											}
										/>
										<div className={styles.structureText}>
											<label
												className={styles.structureTitle}
												htmlFor="genius-refresh-structural"
											>
												{t(
													"genius.refresh.includeStructural",
													"Add/remove lines to match Genius",
												)}
											</label>
											<span className={styles.structureHint}>
												{t(
													"genius.refresh.structuralWarning",
													"New lines start untimed, and removed lines lose their old timing. Existing line timestamps do not move.",
												)}
											</span>
										</div>
									</div>
								)}

								{plan.changedCount === 0 &&
									(!includeStructuralChanges ||
										structuralChangeCount === 0) && (
										<div className={styles.noChanges}>
											{t(
												"genius.refresh.noChanges",
												"Your lyrics already match this Genius page.",
											)}
										</div>
									)}

								<ScrollArea
									className={styles.scroll}
									type="auto"
									scrollbars="vertical"
								>
									<div className={styles.diffList}>
										{plan.entries.map(renderEntry)}
									</div>
								</ScrollArea>

								<footer className={styles.footer}>
									<span className={styles.footerHint}>
										{t(
											"genius.refresh.timingNotice",
											"Line start/end times stay fixed. Word timings are reused when the word count is unchanged.",
										)}
									</span>
									<div className={styles.footerActions}>
										<Dialog.Close asChild>
											<Button variant="ghost" color="gray">
												{t("common.cancel", "Cancel")}
											</Button>
										</Dialog.Close>
										<Button onClick={handleApply} disabled={!canApply}>
											{t("genius.refresh.apply", "Apply changes")}
										</Button>
									</div>
								</footer>
							</>
						) : null}
					</div>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};
