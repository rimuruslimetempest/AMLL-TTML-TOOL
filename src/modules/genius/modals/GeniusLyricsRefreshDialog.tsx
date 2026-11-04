import {
	ArrowLeft20Regular,
	DismissRegular,
	Key20Regular,
	MusicNote1Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	Heading,
	IconButton,
	ScrollArea,
	Spinner,
	Text,
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
import {
	applyGeniusRefreshPlan,
	buildGeniusRefreshPlan,
	extractGeniusLyricLines,
	type GeniusRefreshEntry,
} from "../utils/lyrics-refresh";

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

const getBadgeColor = (
	status: GeniusRefreshEntry["status"],
): "gray" | "green" | "orange" | "blue" | "red" => {
	switch (status) {
		case "unchanged":
			return "green";
		case "changed":
			return "orange";
		case "added":
			return "blue";
		case "removed":
			return "red";
	}
};

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
				if (hits[0]) await loadLyrics(hits[0]);
			} catch (searchError) {
				setError(
					t("genius.refresh.searchFailed", "Genius search failed: {error}", {
						error: getErrorMessage(searchError),
					}),
				);
			} finally {
				setSearching(false);
			}
		},
		[geniusApiKey, loadLyrics, t],
	);

	useEffect(() => {
		if (!isOpen) return;
		const initial = initialQuery();
		setQuery(initial);
		setResults([]);
		setSelectedHit(null);
		setRawLyrics("");
		setHasSearched(false);
		setIncludeStructuralChanges(false);
		setError(null);
		setTempApiKey("");
		if (!initial || (!geniusApiKey && !isGeniusSongUrl(initial))) return;
		const timeout = window.setTimeout(() => {
			void runSearch(initial);
		}, 80);
		return () => window.clearTimeout(timeout);
	}, [isOpen, initialQuery, runSearch, geniusApiKey]);

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

	const renderEntry = (entry: GeniusRefreshEntry, index: number) => {
		const oldLine =
			entry.oldIndex !== null
				? lyricLines.lyricLines[entry.oldIndex]
				: undefined;
		const applied =
			entry.status === "changed" ||
			entry.status === "unchanged" ||
			includeStructuralChanges;
		const label =
			entry.status === "unchanged"
				? t("genius.refresh.matching", "Already matching")
				: entry.status === "changed"
					? t("genius.refresh.changed", "Lyrics changed")
					: entry.status === "added"
						? t("genius.refresh.added", "New on Genius")
						: t("genius.refresh.removed", "Not on Genius");
		const timestamp =
			oldLine && oldLine.endTime > oldLine.startTime
				? `${msToTimestamp(oldLine.startTime)} – ${msToTimestamp(oldLine.endTime)}`
				: t("genius.refresh.untimed", "Needs timing");

		return (
			<Box
				key={`${entry.oldIndex ?? "new"}-${entry.newIndex ?? "old"}-${index}`}
				style={{
					padding: "8px 0",
					borderBottom: "1px solid var(--gray-a4)",
					opacity: applied ? 1 : 0.42,
				}}
			>
				<Flex justify="between" align="center" gap="2" mb="1">
					<Badge color={getBadgeColor(entry.status)} variant="soft" size="1">
						{label}
					</Badge>
					<Text size="1" color="gray">
						{entry.status === "added"
							? t("genius.refresh.untimed", "Needs timing")
							: timestamp}
					</Text>
				</Flex>
				{entry.status !== "added" && entry.oldText && (
					<Text
						size="2"
						color="gray"
						style={{
							display: "block",
							textDecoration:
								entry.status === "removed" || entry.status === "changed"
									? "line-through"
									: undefined,
							opacity: entry.status === "unchanged" ? 1 : 0.7,
							whiteSpace: "pre-wrap",
						}}
					>
						{entry.oldText}
					</Text>
				)}
				{entry.status !== "removed" && entry.newText && (
					<Text
						size="2"
						weight={entry.status === "changed" ? "medium" : "regular"}
						style={{ display: "block", whiteSpace: "pre-wrap" }}
					>
						{entry.newText}
					</Text>
				)}
			</Box>
		);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				aria-describedby={undefined}
				style={{
					maxWidth: 900,
					width: "100%",
					height: "85vh",
					maxHeight: 820,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<Flex
					justify="between"
					align="start"
					gap="3"
					mb="3"
					style={{ flexShrink: 0 }}
				>
					<Flex align="center" gap="3">
						<Box
							style={{
								width: 40,
								height: 40,
								borderRadius: "var(--radius-3)",
								background: "var(--orange-3)",
								color: "var(--orange-11)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
						>
							<MusicNote1Regular style={{ width: 22, height: 22 }} />
						</Box>
						<Box>
							<Dialog.Title size="5" mb="0" style={{ fontWeight: 600 }}>
								{t("genius.refresh.title", "Refresh Lyrics from Genius")}
							</Dialog.Title>
							<Dialog.Description size="2" color="gray">
								{t(
									"genius.refresh.description",
									"Compare with Genius and update the words without moving line timestamps.",
								)}
							</Dialog.Description>
						</Box>
					</Flex>
					<Dialog.Close>
						<IconButton variant="ghost" color="gray" size="2">
							<DismissRegular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				{!selectedHit ? (
					<>
						<Flex gap="2" mb="3" style={{ flexShrink: 0 }}>
							<TextField.Root
								style={{ flex: 1 }}
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
								color="orange"
								onClick={() => void runSearch(query)}
								disabled={searching || !query.trim()}
							>
								{searching ? <Spinner /> : t("common.search", "Search")}
							</Button>
						</Flex>

						{!geniusApiKey && !isGeniusSongUrl(query.trim()) && (
							<Card
								variant="surface"
								style={{
									marginBottom: 12,
									padding: "var(--space-3)",
									background: "var(--gray-2)",
									flexShrink: 0,
								}}
							>
								<Flex align="center" gap="2" mb="1">
									<Key20Regular />
									<Text size="2" weight="medium">
										{t(
											"genius.refresh.tokenSetupTitle",
											"Genius token needed to search",
										)}
									</Text>
								</Flex>
								<Text size="1" color="gray">
									{t(
										"genius.refresh.tokenSetup",
										"Add a CLIENT ACCESS TOKEN, or paste a direct Genius song link above.",
									)}
								</Text>
								<Flex gap="2" mt="2">
									<TextField.Root
										style={{ flex: 1 }}
										placeholder={t(
											"genius.refresh.tokenPlaceholder",
											"Paste CLIENT ACCESS TOKEN",
										)}
										value={tempApiKey}
										onChange={(event) => setTempApiKey(event.target.value)}
									/>
									<Button
										variant="soft"
										disabled={!tempApiKey.trim()}
										onClick={() => {
											setGeniusApiKey(tempApiKey.trim());
											setTempApiKey("");
										}}
									>
										{t("genius.refresh.saveToken", "Save token")}
									</Button>
								</Flex>
								<Button
									variant="ghost"
									size="1"
									onClick={() =>
										void openExternal(
											getGeniusKeyGuideUrl(i18n.resolvedLanguage),
										)
									}
									style={{ paddingLeft: 0 }}
								>
									{t(
										"genius.refresh.howToGetToken",
										"How to create a Genius token",
									)}
								</Button>
							</Card>
						)}

						{error && (
							<Card
								variant="surface"
								style={{
									marginBottom: 12,
									padding: "var(--space-3)",
									background: "var(--red-2)",
									flexShrink: 0,
								}}
							>
								<Text size="2" color="red">
									{error}
								</Text>
							</Card>
						)}

						<ScrollArea
							type="auto"
							scrollbars="vertical"
							style={{ flex: 1, minHeight: 0 }}
						>
							<Flex direction="column" gap="2" pr="2">
								{searching && (
									<Flex align="center" justify="center" p="5" gap="2">
										<Spinner size="3" />
										<Text size="2" color="gray">
											{t("genius.refresh.searching", "Searching Genius…")}
										</Text>
									</Flex>
								)}
								{!searching &&
									results.map((hit) => (
										<Card
											key={hit.id}
											variant="surface"
											onClick={() => void loadLyrics(hit)}
											style={{ cursor: "pointer", padding: "var(--space-3)" }}
										>
											<Flex align="center" gap="3">
												<Box
													style={{
														width: 40,
														height: 40,
														borderRadius: 8,
														background: "var(--orange-3)",
														color: "var(--orange-11)",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														flexShrink: 0,
													}}
												>
													<MusicNote1Regular />
												</Box>
												<Box style={{ flex: 1, minWidth: 0 }}>
													<Text size="3" weight="medium" truncate>
														{hit.title}
													</Text>
													<Text size="1" color="gray" truncate>
														{hit.artist}
														{hit.album ? ` • ${hit.album}` : ""}
													</Text>
												</Box>
												<Badge color="orange" variant="soft">
													Genius
												</Badge>
											</Flex>
										</Card>
									))}
								{!searching &&
									hasSearched &&
									!error &&
									results.length === 0 && (
										<Flex align="center" justify="center" p="5">
											<Text size="2" color="gray">
												{t(
													"genius.refresh.noResults",
													"No songs found. Try another search or paste a Genius link.",
												)}
											</Text>
										</Flex>
									)}
								{!searching && !hasSearched && results.length === 0 && (
									<Flex align="center" justify="center" p="5">
										<Text size="2" color="gray">
											{t(
												"genius.refresh.searchPrompt",
												"Search for the song to refresh from Genius.",
											)}
										</Text>
									</Flex>
								)}
							</Flex>
						</ScrollArea>
					</>
				) : (
					<>
						<Button
							variant="ghost"
							size="2"
							color="gray"
							onClick={handleBack}
							style={{ alignSelf: "flex-start", flexShrink: 0 }}
						>
							<ArrowLeft20Regular style={{ width: 16, height: 16 }} />
							{t("genius.refresh.backToResults", "Back to results")}
						</Button>

						<Card
							variant="surface"
							style={{
								padding: "var(--space-2) var(--space-3)",
								margin: "var(--space-2) 0",
								flexShrink: 0,
							}}
						>
							<Flex align="center" gap="3">
								<Box
									style={{
										width: 42,
										height: 42,
										borderRadius: 8,
										background: "var(--orange-3)",
										color: "var(--orange-11)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
									}}
								>
									<MusicNote1Regular />
								</Box>
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Heading size="3" truncate>
										{selectedHit.title}
									</Heading>
									<Text size="1" color="gray" truncate>
										{selectedHit.artist}
										{selectedHit.album ? ` • ${selectedHit.album}` : ""}
									</Text>
								</Box>
								<Badge color="orange" variant="soft">
									{t("genius.refresh.currentGeniusPage", "Current Genius page")}
								</Badge>
							</Flex>
						</Card>

						{error && (
							<Card
								variant="surface"
								style={{
									marginBottom: 12,
									padding: "var(--space-3)",
									background: "var(--red-2)",
									flexShrink: 0,
								}}
							>
								<Text size="2" color="red">
									{error}
								</Text>
							</Card>
						)}

						{loadingLyrics ? (
							<Flex align="center" justify="center" gap="2" style={{ flex: 1 }}>
								<Spinner size="3" />
								<Text size="2" color="gray">
									{t(
										"genius.refresh.loadingLyrics",
										"Fetching current Genius lyrics…",
									)}
								</Text>
							</Flex>
						) : plan ? (
							<>
								<Flex
									justify="between"
									align="center"
									gap="2"
									mb="2"
									style={{ flexShrink: 0, flexWrap: "wrap" }}
								>
									<Flex gap="2" style={{ flexWrap: "wrap" }}>
										<Badge color="orange" variant="soft">
											{t("genius.refresh.changedCount", "{count} changed", {
												count: plan.changedCount,
											})}
										</Badge>
										<Badge color="green" variant="soft">
											{t("genius.refresh.matchingCount", "{count} matching", {
												count: plan.unchangedCount,
											})}
										</Badge>
										<Badge color="blue" variant="soft">
											{t("genius.refresh.addedCount", "{count} new", {
												count: plan.addedCount,
											})}
										</Badge>
										<Badge color="red" variant="soft">
											{t("genius.refresh.removedCount", "{count} removed", {
												count: plan.removedCount,
											})}
										</Badge>
									</Flex>
									<Text size="1" color="gray">
										{t(
											"genius.refresh.timingNotice",
											"Line start/end times stay fixed. Word timings are reused when the word count is unchanged.",
										)}
									</Text>
								</Flex>

								{structuralChangeCount > 0 && (
									<Card
										variant="surface"
										style={{
											padding: "var(--space-2) var(--space-3)",
											marginBottom: 8,
											background: "var(--amber-2)",
											flexShrink: 0,
										}}
									>
										<Text as="label" size="2">
											<Flex align="center" gap="2">
												<Checkbox
													checked={includeStructuralChanges}
													onCheckedChange={(checked) =>
														setIncludeStructuralChanges(checked === true)
													}
												/>
												{t(
													"genius.refresh.includeStructural",
													"Add/remove lines to match Genius",
												)}
											</Flex>
										</Text>
										<Text
											size="1"
											color="gray"
											style={{ display: "block", marginTop: 4 }}
										>
											{t(
												"genius.refresh.structuralWarning",
												"New lines start untimed, and removed lines lose their old timing. Existing line timestamps do not move.",
											)}
										</Text>
									</Card>
								)}

								{plan.changedCount === 0 &&
									(!includeStructuralChanges ||
										structuralChangeCount === 0) && (
										<Text size="2" color="green" mb="2">
											{t(
												"genius.refresh.noChanges",
												"Your lyrics already match this Genius page.",
											)}
										</Text>
									)}

								<ScrollArea
									type="auto"
									scrollbars="vertical"
									style={{ flex: 1, minHeight: 0, paddingRight: 8 }}
								>
									<Box>{plan.entries.map(renderEntry)}</Box>
								</ScrollArea>

								<Flex justify="end" gap="2" mt="3" style={{ flexShrink: 0 }}>
									<Dialog.Close>
										<Button variant="soft" color="gray">
											{t("common.cancel", "Cancel")}
										</Button>
									</Dialog.Close>
									<Button
										color="orange"
										onClick={handleApply}
										disabled={!canApply}
									>
										{t("genius.refresh.apply", "Update lyrics only")}
									</Button>
								</Flex>
							</>
						) : null}
					</>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};
