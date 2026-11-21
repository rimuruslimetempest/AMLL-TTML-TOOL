import {
	ArrowSync20Regular,
	QuestionCircle20Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Dialog,
	Flex,
	Grid,
	Progress,
	SegmentedControl,
	Select,
	Text,
	TextField,
} from "@radix-ui/themes";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { termsDialogAtom } from "$/modules/privacy/states";
import { lyricLinesAtom } from "$/states/main";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import { DownloaderSetupGuideDialog } from "./DownloaderSetupGuideDialog";
import { loadAudioFromPath } from "./download-helper";
import styles from "./downloader.module.css";
import {
	AUDIO_FORMATS,
	COOKIE_BROWSERS,
	type CookieBrowser,
	type DownloadEvent,
	type DownloadFormat,
	type DownloadErrorInfo,
	downloadError,
	explainDownloadError,
	formatDuration,
	isPlaylistUrl,
	metadataQuery,
	nextSearchQuery,
	type SearchResult,
	VIDEO_FORMATS,
	validDownloadUrl,
} from "./model";
import {
	downloaderCacheAtom,
	downloaderCookiesFileAtom,
	downloaderCookieBrowserAtom,
	downloaderInitialFormatAtom,
	downloaderInitialQueryAtom,
	downloaderInitialTrackAtom,
	downloaderInitialUrlAtom,
	downloaderLegalNoticeAtom,
	downloaderOpenAtom,
} from "./states";

export function DownloaderDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(downloaderOpenAtom);
	const [initialQuery, setInitialQuery] = useAtom(downloaderInitialQueryAtom);
	const [initialUrl, setInitialUrl] = useAtom(downloaderInitialUrlAtom);
	const [initialTrack, setInitialTrack] = useAtom(downloaderInitialTrackAtom);
	const [initialFormat, setInitialFormat] = useAtom(
		downloaderInitialFormatAtom,
	);
	const store = useStore();
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [results, setResults] = useState<SearchResult[] | null>(null);
	const [searchFailure, setSearchFailure] = useState<string | null>(null);
	const searchRun = useRef(0);
	// The last query filled in from the lyrics, so a new song can replace it
	// as long as the user hasn't typed their own.
	const lastAutoQuery = useRef("");
	const jobId = useRef<string | null>(null);
	const [available, setAvailable] = useState<boolean | null>(null);
	const [url, setUrl] = useState("");
	const [mode, setMode] = useState("audio");
	const [format, setFormat] = useState<DownloadFormat>("mp3");
	const [cookieBrowser, setCookieBrowser] = useAtom(
		downloaderCookieBrowserAtom,
	);
	const [cookiesFile] = useAtom(downloaderCookiesFileAtom);
	const [cache, setCache] = useAtom(downloaderCacheAtom);
	const [noticeSeen, setNoticeSeen] = useAtom(downloaderLegalNoticeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const setTermsOpen = useSetAtom(termsDialogAtom);
	const [height, setHeight] = useState("1080");
	const [busy, setBusy] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [event, setEvent] = useState<DownloadEvent | null>(null);
	const [failure, setFailure] = useState<DownloadErrorInfo | null>(null);
	const [actionBusy, setActionBusy] = useState(false);
	const [playlist, setPlaylist] = useState<SearchResult[] | null>(null);
	const [playlistIndex, setPlaylistIndex] = useState("0");
	const [result, setResult] = useState<string | null>(null);
	const running = useRef(false);
	const [guideOpen, setGuideOpen] = useState(false);

	const checkAvailability = useCallback(() => {
		setAvailable(null);
		if (!isTauri()) {
			setAvailable(false);
			return;
		}
		void invoke<boolean>("downloader_available").then(
			(value) => setAvailable(value),
			() => setAvailable(false),
		);
	}, []);

	useEffect(() => {
		if (!open) return;
		checkAvailability();
	}, [open, checkAvailability]);

	const search = useCallback(
		async (searchText?: string) => {
			const text = (searchText ?? query).trim();
			if (!text || !available) return;
			const run = ++searchRun.current;
			setSearching(true);
			setSearchFailure(null);
			try {
				const found = await invoke<SearchResult[]>("search_media", {
					query: text,
				});
				if (run === searchRun.current) {
					setResults(found);
					if (found.length > 0 && !url) {
						setUrl(found[0].url);
					}
				}
			} catch (error) {
				if (run !== searchRun.current) return;
				setResults(null);
				const { detail } = downloadError(error);
				setSearchFailure(detail);
			} finally {
				if (run === searchRun.current) setSearching(false);
			}
		},
		[available, query, url],
	);

	// Fill the search with initial track, initial URL, initial query or open lyrics' metadata
	useEffect(() => {
		if (!open) return;

		let targetUrl = initialUrl || "";
		if (initialUrl) {
			setUrl(initialUrl);
			setInitialUrl(null);
		}

		const targetTrack = initialTrack;
		if (initialTrack) {
			targetUrl = initialTrack.url;
			setUrl(initialTrack.url);
			setQuery(initialTrack.title || "");
			setResults([initialTrack]);
			setInitialTrack(null);
		}

		let queryText = "";
		if (initialQuery) {
			if (validDownloadUrl(initialQuery)) {
				targetUrl = initialQuery;
				setUrl(initialQuery);
			} else {
				queryText = initialQuery;
				setQuery(initialQuery);
				lastAutoQuery.current = initialQuery;
			}
			setInitialQuery(null);
		} else if (!targetTrack && !targetUrl) {
			const songQuery = metadataQuery(
				store.get(lyricLinesAtom)?.metadata ?? [],
			);
			const lastAuto = lastAutoQuery.current;
			queryText = nextSearchQuery(query, lastAuto, songQuery);
			setQuery(queryText);
			if (songQuery) lastAutoQuery.current = songQuery;
		}

		if (targetUrl && !targetTrack) {
			setResults([
				{
					url: targetUrl,
					title: queryText || targetUrl,
					channel: null,
				},
			]);
		}

		if (initialFormat) {
			setFormat(initialFormat);
			setMode(
				initialFormat === "mp4" || initialFormat === "mkv" ? "video" : "audio",
			);
			setInitialFormat(null);
		}

		// Only auto-search if a query string exists, no direct target URL was supplied, and available
		if (queryText && !targetUrl && available) {
			void search(queryText);
		}
	}, [
		open,
		initialTrack,
		initialUrl,
		initialQuery,
		initialFormat,
		available,
		store,
		query,
		search,
		setInitialTrack,
		setInitialUrl,
		setInitialQuery,
		setInitialFormat,
	]);

	// When availability is confirmed, auto-trigger search if query exists and no results yet and no URL already chosen
	useEffect(() => {
		if (open && available && query.trim() && !results && !searching && !url) {
			void search(query.trim());
		}
	}, [open, available, query, results, searching, url, search]);

	async function loadIntoEditor(path: string) {
		try {
			const file = await loadAudioFromPath(path, format);
			await audioEngine.loadMusic(file, false, true);
			toast.success(
				t("downloader.loadedIntoEditor", 'Loaded "{title}" into editor', {
					title: file.name,
				}),
			);
		} catch (loadErr) {
			console.warn("Failed to auto-load audio into editor:", loadErr);
			toast.error(
				t(
					"downloader.loadFailed",
					"Download saved, but it could not be loaded into the editor.",
				),
			);
		}
	}

	async function download(target: string) {
		if (
			running.current ||
			!available ||
			!noticeSeen ||
			!validDownloadUrl(target)
		) {
			return;
		}
		// Never fetch the same audio twice when the saved copy is still there.
		const cached = cache[target];
		if (
			mode === "audio" &&
			cached &&
			cached.format === format &&
			Date.now() - cached.at < 7 * 24 * 60 * 60 * 1000
		) {
			const stillThere = await invoke<boolean>("path_exists", {
				path: cached.path,
			}).catch(() => false);
			if (stillThere) {
				setResult(cached.path);
				await loadIntoEditor(cached.path);
				toast.info("This link was already downloaded. Using the saved file.");
				return;
			}
		}
		running.current = true;
		setBusy(true);
		setCancelling(false);
		setFailure(null);
		setResult(null);
		setEvent(null);
		const events = new Channel<DownloadEvent>();
		events.onmessage = setEvent;
		const id = crypto.randomUUID();
		jobId.current = id;
		try {
			const downloadedPath = await invoke<string | null>("download_media", {
				request: {
					url: target,
					format,
					maxHeight:
						mode === "video" && height !== "best" ? Number(height) : null,
					cookiesFromBrowser: cookieBrowser === "none" ? null : cookieBrowser,
					cookiesFile: cookiesFile.trim() || null,
				},
				jobId: id,
				events,
			});
			setResult(downloadedPath);
			if (downloadedPath) {
				setCache((previous) => {
					const now = Date.now();
					const next = Object.fromEntries(
						Object.entries(previous).filter(
							([, entry]) => now - entry.at < 30 * 24 * 60 * 60 * 1000,
						),
					);
					next[target] = {
						path: downloadedPath,
						title: downloadedPath.split(/[/\\]/).pop() ?? target,
						format,
						at: now,
					};
					return next;
				});
			}
			if (downloadedPath && mode === "audio") await loadIntoEditor(downloadedPath);
		} catch (error) {
			setFailure(explainDownloadError(error));
		} finally {
			jobId.current = null;
			running.current = false;
			setBusy(false);
			setCancelling(false);
			setEvent(null);
		}
	}

	async function start() {
		const target = url.trim();
		if (!target || !validDownloadUrl(target) || !noticeSeen) return;
		if (isPlaylistUrl(target) && playlist === null) {
			setActionBusy(true);
			setFailure(null);
			try {
				const items = await invoke<SearchResult[]>("list_playlist", {
					url: target,
				});
				if (items.length > 1) {
					setPlaylist(items);
					setPlaylistIndex("0");
					return;
				}
				if (items.length === 1) {
					setUrl(items[0].url);
					void download(items[0].url);
					return;
				}
				setFailure(
					explainDownloadError({
						code: "failed",
						detail: "The playlist had no downloadable items.",
					}),
				);
			} catch (error) {
				setFailure(explainDownloadError(error));
			} finally {
				setActionBusy(false);
			}
			return;
		}
		void download(target);
	}

	async function handleFailureAction() {
		const action = failure?.action;
		if (!action) return;
		if (action === "retry") {
			void download(url.trim());
			return;
		}
		if (action === "settings" || action === "cookies") {
			setSettingsTab("audio");
			setSettingsOpen(true);
			return;
		}
		setActionBusy(true);
		try {
			await invoke(action === "update" ? "update_ytdlp" : "download_ffmpeg");
			toast.success(
				action === "update"
					? "yt-dlp was updated and verified."
					: "FFmpeg was downloaded and verified.",
			);
			setFailure(null);
			checkAvailability();
		} catch (error) {
			setFailure(explainDownloadError(error));
		} finally {
			setActionBusy(false);
		}
	}

	async function cancel() {
		const id = jobId.current;
		if (!id) return;
		setCancelling(true);
		try {
			await invoke("cancel_download", { jobId: id });
		} catch (error) {
			setFailure(explainDownloadError(error));
			setCancelling(false);
		}
	}

	const progress = event?.kind === "downloading" ? event.percent : null;
	const status = cancelling
		? t("downloader.cancelling")
		: event?.kind === "processing"
			? t("downloader.processing")
			: event?.kind === "downloading"
				? t("downloader.downloading")
				: event?.kind === "preparing"
					? t("downloader.preparing")
					: t("downloader.pickFolder");
	const errorText = failure ? `${failure.title}. ${failure.message}` : "";
	const actionLabel =
		failure?.action === "update"
			? "Update yt-dlp"
			: failure?.action === "ffmpeg"
				? "Download FFmpeg"
				: failure?.action === "cookies" || failure?.action === "settings"
					? "Open Audio sources"
					: failure?.action === "retry"
						? "Try again"
						: null;
	const cookieBrowserLabels: Record<(typeof COOKIE_BROWSERS)[number], string> = {
		brave: t("downloader.cookiesBrave"),
		chrome: t("downloader.cookiesChrome"),
		edge: t("downloader.cookiesEdge"),
		firefox: t("downloader.cookiesFirefox"),
	};

	return (
		<>
			<Dialog.Root open={open} onOpenChange={setOpen}>
				<Dialog.Content maxWidth="840px" className={styles.content}>
					<Flex justify="between" align="start" wrap="wrap" gap="2" mb="2">
						<Box>
							<Dialog.Title style={{ margin: 0 }}>
								{t("downloader.title")}
							</Dialog.Title>
							<Dialog.Description size="2" mt="1">
								{t("downloader.description")}
							</Dialog.Description>
						</Box>
						<Button
							type="button"
							variant="soft"
							size="1"
							onClick={() => setGuideOpen(true)}
						>
							<QuestionCircle20Regular />
							{t("downloader.setupGuide", "Setup Guide")}
						</Button>
					</Flex>
					<Flex direction="column" gap="3">
						{!noticeSeen && (
							<Callout.Root color="amber">
								<Callout.Text>
									Only download audio you have the right to use. You are
									responsible for following the terms of the site and for
									copyright. TTML Tool runs yt-dlp on this computer and does
									not upload the link or the file anywhere.
								</Callout.Text>
								<Flex gap="2" mt="2" wrap="wrap">
									<Button size="1" onClick={() => setNoticeSeen(true)}>
										I understand
									</Button>
									<Button
										size="1"
										variant="soft"
										color="gray"
										onClick={() => setTermsOpen(true)}
									>
										Terms of Use
									</Button>
								</Flex>
							</Callout.Root>
						)}
						{available === false && (
							<Callout.Root color="amber">
								<Flex
									justify="between"
									align="center"
									wrap="wrap"
									gap="2"
									style={{ width: "100%" }}
								>
									<Callout.Text>
										{t(
											isTauri()
												? "downloader.unavailable"
												: "downloader.desktopOnly",
										)}
									</Callout.Text>
									<Flex gap="2">
										<Button
											type="button"
											size="1"
											variant="surface"
											onClick={() => {
												setSettingsTab("audio");
												setSettingsOpen(true);
											}}
										>
											Audio sources
										</Button>
										<Button
											type="button"
											size="1"
											variant="surface"
											color="amber"
											onClick={() => setGuideOpen(true)}
										>
											<QuestionCircle20Regular />
											{t("downloader.setupGuide", "Setup Guide")}
										</Button>
										{isTauri() && (
											<Button
												type="button"
												size="1"
												variant="surface"
												onClick={checkAvailability}
											>
												<ArrowSync20Regular />
												{t("downloader.recheck", "Recheck")}
											</Button>
										)}
									</Flex>
								</Flex>
							</Callout.Root>
						)}
					<Grid
						columns={{ initial: "1", sm: "1.1fr 1fr" }}
						gap="4"
						align="start"
					>
						{/* Left Column: Search & Results */}
						<Box>
							<form
								role="search"
								onSubmit={(e) => {
									e.preventDefault();
									void search();
								}}
							>
								<Flex direction="column" gap="2">
									<Text as="label" size="2" htmlFor="downloader-search">
										{t("downloader.searchLabel")}
									</Text>
									<Flex gap="2">
										<TextField.Root
											id="downloader-search"
											type="search"
											className={styles.grow}
											value={query}
											onChange={(e) => setQuery(e.target.value)}
											placeholder={t("downloader.searchPlaceholder")}
											maxLength={200}
										/>
										<Button
											type="submit"
											variant="soft"
											disabled={!available || searching || !query.trim()}
										>
											{t(
												searching
													? "downloader.searching"
													: "downloader.search",
											)}
										</Button>
									</Flex>
									{searchFailure != null && (
										<Callout.Root color="red" role="alert">
											<Callout.Text>
												{t("downloader.searchFailed")}
											</Callout.Text>
											{searchFailure && (
												<details className={styles.details}>
													<summary>{t("downloader.details")}</summary>
													<pre>{searchFailure}</pre>
												</details>
											)}
										</Callout.Root>
									)}
									{results === null ? (
										<Flex
											align="center"
											justify="center"
											direction="column"
											gap="1"
											className={styles.emptyResults}
										>
											<Text size="2" color="gray">
												{t("downloader.searchLabel")}
											</Text>
										</Flex>
									) : results.length === 0 ? (
										<Flex
											align="center"
											justify="center"
											className={styles.emptyResults}
										>
											<Text size="2" color="gray" role="status">
												{t("downloader.noResults")}
											</Text>
										</Flex>
									) : (
										<ul
											className={styles.results}
											aria-label={t("downloader.searchResults")}
										>
											{results.map((item) => {
												const selected = item.url === url.trim();
												const meta = [
													item.channel,
													formatDuration(item.duration),
												]
													.filter(Boolean)
													.join(" · ");
												return (
													<li key={item.url}>
														<button
															type="button"
															className={styles.result}
															aria-pressed={selected}
															disabled={busy}
															onClick={() => setUrl(item.url)}
														>
															<span className={styles.resultTitle}>
																{item.title}
															</span>
															{meta && (
																<span className={styles.resultMeta}>
																	{meta}
																</span>
															)}
														</button>
													</li>
												);
											})}
										</ul>
									)}
								</Flex>
							</form>
						</Box>

						{/* Right Column: Download Configuration & Actions */}
						<Box>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									void start();
								}}
							>
								<Flex direction="column" gap="3">
									<Text as="label" size="2" htmlFor="downloader-url">
										{t("downloader.url")}
									</Text>
									<TextField.Root
										id="downloader-url"
										aria-label={t("downloader.url")}
										type="url"
										value={url}
										onChange={(e) => setUrl(e.target.value)}
										disabled={busy}
										required
										placeholder="https://..."
									/>
									{url.trim() && !validDownloadUrl(url.trim()) && (
										<Text size="2" color="red">
											{t("downloader.invalidUrl")}
										</Text>
									)}
									{playlist && playlist.length > 1 && (
										<Callout.Root color="amber">
											<Callout.Text>
												This link is a playlist. Choose one item to download:
											</Callout.Text>
											<Select.Root
												value={playlistIndex}
												onValueChange={setPlaylistIndex}
											>
												<Select.Trigger
													aria-label="Playlist item"
													style={{ width: "100%" }}
												/>
												<Select.Content>
													{playlist.map((item, index) => (
														<Select.Item key={item.url} value={String(index)}>
															{item.title}
														</Select.Item>
													))}
												</Select.Content>
											</Select.Root>
											<Flex gap="2" mt="2" wrap="wrap">
												<Button
													size="1"
													onClick={() => {
														const item = playlist[Number(playlistIndex)];
														if (!item) return;
														setUrl(item.url);
														setPlaylist(null);
														void download(item.url);
													}}
												>
													Download selected item
												</Button>
												<Button
													size="1"
													variant="soft"
													color="gray"
													onClick={() => setPlaylist(null)}
												>
													Cancel
												</Button>
											</Flex>
										</Callout.Root>
									)}
									<SegmentedControl.Root
										aria-label={t("downloader.mediaType")}
										value={mode}
										disabled={busy}
										onValueChange={(value) => {
											setMode(value);
											setFormat(value === "audio" ? "mp3" : "mp4");
										}}
									>
										<SegmentedControl.Item value="audio">
											{t("downloader.audio")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value="video">
											{t("downloader.video")}
										</SegmentedControl.Item>
									</SegmentedControl.Root>
									<Flex gap="3" wrap="wrap">
										<Flex direction="column" gap="2" flexGrow="1">
											<Text as="label" size="2" htmlFor="downloader-format">
												{t("downloader.format")}
											</Text>
											<Select.Root
												key={mode}
												value={format}
												onValueChange={(value) => {
													if (
														[...AUDIO_FORMATS, ...VIDEO_FORMATS].includes(
															value as DownloadFormat,
														)
													)
														setFormat(value as DownloadFormat);
												}}
												disabled={busy}
											>
												<Select.Trigger
													id="downloader-format"
													aria-label={t("downloader.format")}
												/>
												<Select.Content>
													{(mode === "audio"
														? AUDIO_FORMATS
														: VIDEO_FORMATS
													).map((value) => (
														<Select.Item key={value} value={value}>
															{value.toUpperCase()}
														</Select.Item>
													))}
												</Select.Content>
											</Select.Root>
										</Flex>
										{mode === "video" && (
											<Flex direction="column" gap="2" flexGrow="1">
												<Text as="label" size="2" htmlFor="downloader-height">
													{t("downloader.quality")}
												</Text>
												<Select.Root
													value={height}
													onValueChange={setHeight}
													disabled={busy}
												>
													<Select.Trigger
														id="downloader-height"
														aria-label={t("downloader.quality")}
													/>
													<Select.Content>
														{["720", "1080", "2160"].map((value) => (
															<Select.Item key={value} value={value}>
																{value}p
															</Select.Item>
														))}
														<Select.Item value="best">
															{t("downloader.best")}
														</Select.Item>
													</Select.Content>
												</Select.Root>
											</Flex>
										)}
									</Flex>
									<Flex direction="column" gap="2">
										<Text as="label" size="2" htmlFor="downloader-cookies">
											{t("downloader.cookies")}
										</Text>
										<Select.Root
											value={cookieBrowser}
											onValueChange={(value) =>
												setCookieBrowser(value as CookieBrowser)
											}
											disabled={busy}
										>
											<Select.Trigger
												id="downloader-cookies"
												aria-label={t("downloader.cookies")}
											/>
											<Select.Content>
												<Select.Item value="none">
													{t("downloader.cookiesNone")}
												</Select.Item>
												{COOKIE_BROWSERS.map((browser) => (
													<Select.Item key={browser} value={browser}>
														{cookieBrowserLabels[browser]}
													</Select.Item>
												))}
											</Select.Content>
										</Select.Root>
										<Text size="1" color="gray">
											{t("downloader.cookiesHint")}
										</Text>
									</Flex>
									<Text size="1" color="gray">
										{t("downloader.folderHint")}
									</Text>
									{busy && (
										<Flex
											direction="column"
											gap="2"
											role="status"
											aria-live="polite"
										>
											<Text size="2">
												{status}
												{progress != null ? ` (${progress.toFixed(1)}%)` : ""}
											</Text>
											{progress != null && (
												<Progress
													value={progress}
													aria-label={t("downloader.downloading")}
												/>
											)}
										</Flex>
									)}
									{failure && (
										<Callout.Root
											color={failure.code === "cancelled" ? "gray" : "red"}
											role="alert"
										>
											<Callout.Text>{errorText}</Callout.Text>
											{actionLabel && (
												<Button
													size="1"
													mt="2"
													onClick={() => void handleFailureAction()}
													loading={actionBusy}
													disabled={busy || actionBusy}
												>
													{actionLabel}
												</Button>
											)}
											{failure.detail && (
												<details className={styles.details}>
													<summary>{t("downloader.details")}</summary>
													<pre>{failure.detail}</pre>
												</details>
											)}
										</Callout.Root>
									)}
									{result && (
										<Flex direction="column" gap="2">
											<Callout.Root color="green" role="status">
												<Callout.Text>
													{t("downloader.saved")}
													<br />
													<span className={styles.path}>{result}</span>
												</Callout.Text>
											</Callout.Root>
											{mode === "audio" && (
												<Flex justify="end">
													<Button
														size="1"
														variant="surface"
														type="button"
														onClick={async () => {
															try {
																const file = await loadAudioFromPath(
																	result,
																	format,
																);
																await audioEngine.loadMusic(file, false, true);
																toast.success(
																	t(
																		"downloader.loadedIntoEditor",
																		'Loaded "{title}" into editor',
																		{
																			title: file.name,
																		},
																	),
																);
															} catch (loadErr) {
																console.warn(
																	"Failed to load audio into editor:",
																	loadErr,
																);
																toast.error(
																	t(
																		"downloader.loadFailed",
																		"Download saved, but it could not be loaded into the editor.",
																	),
																);
															}
														}}
													>
														{t("downloader.loadIntoEditor", "Load into Editor")}
													</Button>
												</Flex>
											)}
										</Flex>
									)}
									<Flex justify="end" gap="2" wrap="wrap" mt="2">
										<Dialog.Close>
											<Button type="button" variant="soft">
												{t("downloader.close")}
											</Button>
										</Dialog.Close>
										{busy ? (
											<Button
												type="button"
												color="red"
												variant="soft"
												disabled={cancelling}
												onClick={() => void cancel()}
											>
												{t("downloader.cancel")}
											</Button>
										) : (
											<Button
												type="submit"
												disabled={
													!available ||
													!noticeSeen ||
													!validDownloadUrl(url.trim())
												}
											>
												{t(
													available === null
														? "downloader.checking"
														: "downloader.download",
												)}
											</Button>
										)}
									</Flex>
								</Flex>
							</form>
						</Box>
					</Grid>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
		<DownloaderSetupGuideDialog
			open={guideOpen}
			onOpenChange={setGuideOpen}
			available={available}
			onAvailabilityChange={setAvailable}
		/>
	</>
	);
}
