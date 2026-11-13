import {
	ArrowDownload16Regular,
	CloudArrowUp16Regular,
	Copy16Regular,
	Dismiss16Regular,
	Globe16Regular,
	MusicNote2Filled,
	Open16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { audioCoverArtAtom } from "$/modules/audio/states";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { spotMatchLastOutputAtom } from "$/modules/spotmatch/states";
import { lyricLinesAtom, projectIdAtom, projectIdentityAtom } from "$/states/main";
import { openExternal } from "$/utils/openExternal";
import { saveFile } from "$/utils/fileSystem";
import {
	buildTtmlFileName,
	buildUploaderDefaults,
	DISCORD_APP_URL,
	extractSpotifyIds,
	formatBytes,
	formatLanguageLabel,
	formatPostText,
	getCoverArtFromMetadata,
	getDefaultTitle,
	getSongLinks,
	loadLegacyUploaderInfo,
	loadUploaderDraft,
	normalizeSpotifyIds,
	saveUploaderDraft,
	TTML_UPLOADS_CHANNEL_MENTION,
	TTML_UPLOADS_CHANNEL_NAME,
	type TtmlUploaderDraft,
} from "./logic";
import { ttmlUploaderOpenAtom } from "./states";

type UploaderView = "compose" | "preview";

function SetterButton({
	children,
	onClick,
	disabled,
}: {
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Button
			size="1"
			variant="ghost"
			color="gray"
			disabled={disabled}
			onClick={onClick}
			style={{ paddingInline: 6 }}
		>
			{children}
		</Button>
	);
}

export function TtmlUploaderPanel() {
	const [open, setOpen] = useAtom(ttmlUploaderOpenAtom);
	const projectId = useAtomValue(projectIdAtom);
	const projectIdentity = useAtomValue(projectIdentityAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const normalization = useAtomValue(lyricTextNormalizationOptionsAtom);
	const allowConsecutiveBackgroundLines = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const coverArt = useAtomValue(audioCoverArtAtom);
	const lastSpotMatchOutput = useAtomValue(spotMatchLastOutputAtom);
	const [draft, setDraft] = useState<TtmlUploaderDraft>(() =>
		buildUploaderDefaults(projectIdentity, lyric),
	);
	const [view, setView] = useState<UploaderView>("compose");
	const loadedProjectRef = useRef<string | null>(null);

	useEffect(() => {
		if (!open) {
			loadedProjectRef.current = null;
			return;
		}
		if (loadedProjectRef.current === projectId) return;
		loadedProjectRef.current = projectId;

		const stored = loadUploaderDraft(projectId);
		const legacy = loadLegacyUploaderInfo(projectId);
		if (stored) {
			setDraft({
				...stored,
				songLinks: stored.songLinks || legacy?.songLinks || "",
				spotifyIds: stored.spotifyIds || legacy?.spotifyIds || "",
			});
		} else {
			const defaults = buildUploaderDefaults(projectIdentity, lyric);
			setDraft({
				...defaults,
				songLinks: legacy?.songLinks || defaults.songLinks,
				spotifyIds: legacy?.spotifyIds || defaults.spotifyIds,
			});
		}
		setView("compose");
	}, [open, projectId, projectIdentity, lyric]);

	useEffect(() => {
		if (open) saveUploaderDraft(projectId, draft);
	}, [draft, open, projectId]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, setOpen]);

	const ttmlText = useMemo(
		() =>
			exportTTMLText(lyric, normalization, {
				allowConsecutiveBackgroundLines,
			}),
		[lyric, normalization, allowConsecutiveBackgroundLines],
	);
	const ttmlFileName = buildTtmlFileName(projectIdentity, draft.title);
	const ttmlSize = new TextEncoder().encode(ttmlText).length;
	const displayTitle =
		draft.title.trim() || getDefaultTitle(projectIdentity) || "Untitled";
	const languageLabel = formatLanguageLabel(draft.language) || "No language";
	const cover = coverArt || getCoverArtFromMetadata(lyric);
	const effectiveIds = Array.from(
		new Set([
			...extractSpotifyIds(draft.spotifyIds),
			...extractSpotifyIds(draft.songLinks),
		]),
	);
	const effectiveLinks = getSongLinks({
		...draft,
		spotifyIds: effectiveIds.join(","),
	});
	const postText = formatPostText({
		...draft,
		spotifyIds: effectiveIds.join(","),
	});
	const spotifyHref =
		effectiveLinks.find((link) => link.includes("open.spotify.com")) ??
		effectiveLinks[0];
	const lastSpotMatchIds = normalizeSpotifyIds(lastSpotMatchOutput);
	const artist = projectIdentity.artist || "Unknown artist";

	const handleCopy = async () => {
		if (!postText) {
			toast.error("Add a song link or Spotify ID first.");
			return;
		}
		try {
			await navigator.clipboard.writeText(postText);
			toast.success("Post text copied. Paste it into #ttml-uploads.");
		} catch {
			toast.error("Could not copy the post text.");
		}
	};

	const handleDownload = async () => {
		try {
			await saveFile(ttmlText, {
				suggestedName: ttmlFileName,
				types: [
					{
						description: "TTML lyrics",
						accept: { "application/xml": [".ttml"] },
					},
				],
			});
			toast.success(`TTML ready: ${ttmlFileName}`);
		} catch (error) {
			console.error("Failed to save TTML file", error);
			toast.error("Could not save the TTML file.");
		}
	};

	const handleCopyChannel = async () => {
		try {
			await navigator.clipboard.writeText(TTML_UPLOADS_CHANNEL_MENTION);
			toast.success("Channel reference copied.");
		} catch {
			toast.error("Could not copy the channel reference.");
		}
	};

	const handlePrepare = async () => {
		if (!postText) {
			toast.error("Add a song link or Spotify ID first.");
			return;
		}
		await handleCopy();
		await handleDownload();
		await openExternal(DISCORD_APP_URL);
		toast.info("Paste the post and attach the TTML in #ttml-uploads.");
	};

	const handleUseMetadata = () => {
		const defaults = buildUploaderDefaults(projectIdentity, lyric);
		setDraft((current) => ({
			...defaults,
			title: current.title.trim() ? current.title : defaults.title,
		}));
		toast.success("Project metadata loaded into the uploader.");
	};

	const handleUseSpotMatch = () => {
		if (!lastSpotMatchIds) {
			toast.info("No recent SpotMatch IDs found.");
			return;
		}
		setDraft((current) => ({
			...current,
			spotifyIds: lastSpotMatchIds,
		}));
		toast.success("Recent SpotMatch IDs added.");
	};

	if (!open) return null;

	return (
		<Flex
			data-testid="ttml-uploader-panel"
			role="dialog"
			aria-modal="true"
			aria-label="TTML uploader"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1300,
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
			}}
		>
			<Box
				onClick={() => setOpen(false)}
				style={{
					position: "absolute",
					inset: 0,
					background: "rgba(0, 0, 0, 0.62)",
					backdropFilter: "blur(3px)",
				}}
			/>
			<Card
				style={{
					position: "relative",
					width: 880,
					maxWidth: "96vw",
					maxHeight: "92vh",
					display: "flex",
					flexDirection: "column",
					background: "#1e1f22",
					color: "#f2f3f5",
					border: "1px solid #3f4147",
					borderRadius: 16,
					boxShadow: "0 24px 80px rgba(0, 0, 0, 0.55)",
					overflow: "hidden",
				}}
			>
				<Flex
					align="center"
					justify="between"
					style={{
						padding: "18px 22px",
						borderBottom: "1px solid #3f4147",
						background: "#232428",
					}}
				>
					<Flex align="center" gap="3">
						<Flex
							align="center"
							justify="center"
							style={{
								width: 38,
								height: 38,
								borderRadius: 10,
								background: "#5865f2",
								color: "#fff",
							}}
						>
							<CloudArrowUp16Regular />
						</Flex>
						<Box>
							<Heading size="4" style={{ color: "#f2f3f5" }}>
								New TTML upload
							</Heading>
							<Text size="1" style={{ color: "#b5bac1" }}>
								{TTML_UPLOADS_CHANNEL_NAME} · manual post
							</Text>
						</Box>
					</Flex>
					<Flex align="center" gap="2">
						<Button
							size="2"
							variant="soft"
							color="gray"
							onClick={() =>
								setView(view === "compose" ? "preview" : "compose")
							}
						>
							{view === "compose" ? "Preview" : "Edit"}
						</Button>
						<IconButton
							size="2"
							variant="ghost"
							color="gray"
							aria-label="Close TTML uploader"
							onClick={() => setOpen(false)}
						>
							<Dismiss16Regular />
						</IconButton>
					</Flex>
				</Flex>

				<Box style={{ overflowY: "auto", padding: "18px 22px 20px" }}>
					{view === "compose" ? (
						<Flex direction="column" gap="4">
							<Box>
								<Flex justify="between" align="baseline" mb="2">
									<Text size="2" weight="bold">
										Title
									</Text>
									<Text size="1" style={{ color: "#949ba4" }}>
										Defaults to artist - song
									</Text>
								</Flex>
								<TextField.Root
									value={draft.title}
									placeholder="artist - song"
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											title: event.target.value,
										}))
									}
								/>
								<Flex align="center" gap="2" mt="2">
									<Text size="1" style={{ color: "#b5bac1" }}>
										Language
									</Text>
									<TextField.Root
										value={draft.language}
										placeholder="English"
										style={{ maxWidth: 180 }}
										onChange={(event) =>
											setDraft((current) => ({
												...current,
												language: event.target.value,
											}))
										}
									/>
									<Badge color="gray" variant="soft">
										<Globe16Regular />
										{languageLabel}
									</Badge>
								</Flex>
							</Box>

							<Box>
								<Flex justify="between" align="center" mb="2">
									<Box>
										<Text size="2" weight="bold">
											Song link(s)
										</Text>
										<Text
											size="1"
											style={{ display: "block", color: "#949ba4" }}
										>
											One per line. These become the post links.
										</Text>
									</Box>
									<SetterButton onClick={handleUseMetadata}>
										Use project metadata
									</SetterButton>
								</Flex>
								<TextArea
									value={draft.songLinks}
									rows={3}
									placeholder="https://open.spotify.com/track/..."
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											songLinks: event.target.value,
										}))
									}
								/>
							</Box>

							<Box>
								<Flex justify="between" align="center" mb="2">
									<Box>
										<Text size="2" weight="bold">
											Song ID's
										</Text>
										<Text
											size="1"
											style={{ display: "block", color: "#949ba4" }}
										>
											Comma-separated Spotify IDs. Links are derived when
											needed.
										</Text>
									</Box>
									<SetterButton
										onClick={handleUseSpotMatch}
										disabled={!lastSpotMatchIds}
									>
										Use last SpotMatch IDs
									</SetterButton>
								</Flex>
								<TextArea
									value={draft.spotifyIds}
									rows={3}
									placeholder="4KDzpPbSialeRILXzZPhiP,3cDQ3nWTLdKP5JtHje7fC"
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											spotifyIds: event.target.value,
										}))
									}
								/>
								<Text
									size="1"
									mt="2"
									style={{ display: "block", color: "#949ba4" }}
								>
									{effectiveIds.length} Spotify ID(s) detected.
								</Text>
							</Box>

							<Card
								style={{
									padding: 14,
									background: "#2b2d31",
									border: "1px solid #3f4147",
								}}
							>
								<Flex align="center" gap="3">
									<Flex
										align="center"
										justify="center"
										style={{
											width: 40,
											height: 40,
											borderRadius: 8,
											background: "#1e1f22",
											color: "#b5bac1",
										}}
									>
										<CloudArrowUp16Regular />
									</Flex>
									<Box style={{ flex: 1 }}>
										<Text size="2" weight="bold">
											TTML attachment
										</Text>
										<Text
											size="1"
											style={{ display: "block", color: "#949ba4" }}
										>
											{ttmlFileName} · {formatBytes(ttmlSize)}
										</Text>
									</Box>
									<Button
										size="1"
										variant="soft"
										color="gray"
										onClick={() => void handleDownload()}
									>
										<ArrowDownload16Regular /> TTML
									</Button>
								</Flex>
							</Card>

							<Card
								style={{
									padding: 14,
									background: "#2b2d31",
									border: "1px solid #3f4147",
								}}
							>
								<Flex align="start" gap="3">
									<Globe16Regular
										style={{ flexShrink: 0, marginTop: 2 }}
									/>
									<Box>
										<Text size="2" weight="bold">
											Discord permissions are the role gate
										</Text>
										<Text
											size="1"
											style={{ display: "block", color: "#b5bac1" }}
										>
											This prepares the post and TTML, then opens
											Discord. Anyone who can post in{" "}
											{TTML_UPLOADS_CHANNEL_NAME} can upload; members
											without permission are blocked by Discord.
										</Text>
									</Box>
								</Flex>
							</Card>
						</Flex>
					) : (
						<Flex direction="column" gap="3">
							<Card
								style={{
									padding: 20,
									background: "#313338",
									border: "1px solid #3f4147",
									borderRadius: 12,
								}}
							>
								<Flex justify="between" align="center" mb="4">
									<Text size="1" style={{ color: "#b5bac1" }}>
										{TTML_UPLOADS_CHANNEL_NAME}
									</Text>
									<Badge color="gray" variant="soft">
										Preview
									</Badge>
								</Flex>
								<Heading size="6" style={{ color: "#f2f3f5" }}>
									{displayTitle}
								</Heading>
								<Badge
									color="gray"
									variant="soft"
									style={{ marginTop: 8, width: "fit-content" }}
								>
									<Globe16Regular />
									{languageLabel}
								</Badge>
								<Flex align="center" gap="2" mt="5" mb="3">
									<Flex
										align="center"
										justify="center"
										style={{
											width: 28,
											height: 28,
											borderRadius: "50%",
											background: "#5865f2",
											color: "#fff",
										}}
									>
										<CloudArrowUp16Regular />
									</Flex>
									<Text size="2" weight="bold">
										You
									</Text>
									<Text size="1" style={{ color: "#949ba4" }}>
										Today
									</Text>
								</Flex>
								<Text
									size="2"
									style={{
										display: "block",
										whiteSpace: "pre-wrap",
										color: "#dbdee1",
										lineHeight: 1.5,
									}}
								>
									{postText ||
										"Add a song link or Spotify ID to build the post."}
								</Text>

								{effectiveIds.length > 0 && (
									<Card
										style={{
											marginTop: 14,
											padding: 10,
											background: "#942137",
											borderRadius: 10,
											color: "#fff",
										}}
									>
										<Flex align="center" gap="3">
											{cover ? (
												<img
													src={cover}
													alt=""
													style={{
														width: 58,
														height: 58,
														borderRadius: 6,
														objectFit: "cover",
														flexShrink: 0,
													}}
												/>
											) : (
												<Flex
													align="center"
													justify="center"
													style={{
														width: 58,
														height: 58,
														borderRadius: 6,
														background: "#6e1628",
														flexShrink: 0,
													}}
												>
													<MusicNote2Filled />
												</Flex>
											)}
											<Box style={{ minWidth: 0, flex: 1 }}>
												<Text
													size="3"
													weight="bold"
													style={{
														display: "block",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{projectIdentity.name || displayTitle}
												</Text>
												<Text
													size="1"
													style={{
														display: "block",
														color: "#f0c4cd",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{artist}
												</Text>
											</Box>
											{spotifyHref && (
												<IconButton
													variant="ghost"
													color="gray"
													aria-label="Open song link"
													onClick={() => void openExternal(spotifyHref)}
													style={{ color: "#fff" }}
												>
													<Open16Regular />
												</IconButton>
											)}
										</Flex>
									</Card>
								)}

								<Card
									style={{
										marginTop: 12,
										padding: "10px 12px",
										background: "#2b2d31",
										border: "1px solid #3f4147",
									}}
								>
									<Flex align="center" gap="3">
										<CloudArrowUp16Regular
											style={{ flexShrink: 0, color: "#b5bac1" }}
										/>
										<Box style={{ flex: 1, minWidth: 0 }}>
											<Text
												size="1"
												weight="bold"
												style={{
													display: "block",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{ttmlFileName}
											</Text>
											<Text size="1" style={{ color: "#949ba4" }}>
												{formatBytes(ttmlSize)} · TTML lyrics
											</Text>
										</Box>
										<IconButton
											size="1"
											variant="ghost"
											color="gray"
											aria-label="Download TTML"
											onClick={() => void handleDownload()}
										>
											<ArrowDownload16Regular />
										</IconButton>
									</Flex>
								</Card>
							</Card>
							<Text size="1" style={{ color: "#949ba4" }}>
								Discord creates the Spotify embed after the link is posted.
								The TTML file downloads separately so you can attach it to
								the post.
							</Text>
						</Flex>
					)}
				</Box>

				<Flex
					align="center"
					justify="between"
					gap="3"
					wrap="wrap"
					style={{
						padding: "14px 22px",
						borderTop: "1px solid #3f4147",
						background: "#232428",
					}}
				>
					<Text size="1" style={{ color: "#949ba4" }}>
						Posting is controlled by Discord channel permissions.
					</Text>
					<Flex gap="2" wrap="wrap" justify="end">
						<Button
							size="2"
							variant="soft"
							color="gray"
							onClick={() => void handleCopyChannel()}
						>
							<Copy16Regular /> Channel ref
						</Button>
						<Button
							size="2"
							variant="soft"
							color="gray"
							onClick={() => void handleDownload()}
						>
							<ArrowDownload16Regular /> Download TTML
						</Button>
						<Button
							size="2"
							variant="soft"
							color="gray"
							onClick={() => void handleCopy()}
						>
							<Copy16Regular /> Copy post
						</Button>
						<Button
							size="2"
							color="indigo"
							onClick={() => void handlePrepare()}
						>
							Copy & open Discord
						</Button>
					</Flex>
				</Flex>
			</Card>
		</Flex>
	);
}
