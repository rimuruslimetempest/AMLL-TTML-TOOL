import {
	ArrowAutofitWidth20Regular,
	ArrowDownload20Regular,
	Broom20Regular,
	CheckmarkCircle20Regular,
	Clock20Regular,
	DocumentText20Regular,
	Flag20Regular,
	History20Regular,
	People20Regular,
	Target20Regular,
	TextAdd20Regular,
	TextGrammarCheckmark20Regular,
	Timer20Regular,
	Wrench20Regular,
} from "@fluentui/react-icons";
import { Button, DropdownMenu, Flex } from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtom, useSetAtom } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	downloaderInitialQueryAtom,
	downloaderOpenAtom,
} from "$/modules/downloader/states";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import { songInfoDialogAtom } from "$/modules/song-info/states";
import {
	applySavedSplitsDialogAtom,
	splitLibraryDialogAtom,
} from "$/modules/split-library/states";
import { handoffSummaryDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { formatKeyBindings } from "$/utils/keybindings";
import { NewMenuIcon } from "../NewMenuIcon";
import { useTopMenuActions } from "../useTopMenuActions";

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const [lyricLines, setLyricLines] = useAtom(lyricLinesAtom);
	const openDownloader = useSetAtom(downloaderOpenAtom);
	const setDownloaderInitialQuery = useSetAtom(downloaderInitialQueryAtom);
	const setSplitLibraryOpen = useSetAtom(splitLibraryDialogAtom);
	const setApplySavedSplitsOpen = useSetAtom(applySavedSplitsDialogAtom);
	const setSongInfoOpen = useSetAtom(songInfoDialogAtom);
	const setHandoffOpen = useSetAtom(handoffSummaryDialogAtom);

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	const tools = pluginManager.getTools();

	const onRunPluginTool = (pluginId: string) => async () => {
		try {
			const nextLines = await pluginManager.runTool(
				pluginId,
				lyricLines.lyricLines,
			);
			setLyricLines((prev) => ({
				...prev,
				lyricLines: nextLines,
			}));
		} catch (e) {
			console.error(`Failed to run tool ${pluginId}:`, e);
			toast.error(e instanceof Error ? e.message : String(e));
		}
	};

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onAutoSegment}
				shortcut={getShortcut(menu.autoSegmentKey)}
			>
				<NewMenuIcon>
					<TextAdd20Regular />
				</NewMenuIcon>
				{t("topBar.menu.autoSegment", "Auto Segment")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => setSongInfoOpen(true)}>
				<NewMenuIcon>
					<TextAdd20Regular />
				</NewMenuIcon>
				{t("topBar.menu.songInfo", "Song Info...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={() => setHandoffOpen(true)}
				disabled={lyricLines.lyricLines.length === 0}
			>
				<NewMenuIcon>
					<DocumentText20Regular />
				</NewMenuIcon>
				{t("topBar.menu.handoffSummary", "Hand-off Summary...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => setSplitLibraryOpen(true)}>
				<NewMenuIcon>
					<History20Regular />
				</NewMenuIcon>
				{t("topBar.menu.splitLibrary", "My Split Library...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={() => setApplySavedSplitsOpen(true)}
				disabled={lyricLines.lyricLines.length === 0}
			>
				<NewMenuIcon>
					<TextAdd20Regular />
				</NewMenuIcon>
				{t("topBar.menu.applySavedSplits", "Apply Saved Splits to Song...")}
			</DropdownMenu.Item>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<NewMenuIcon>
						<TextAdd20Regular />
					</NewMenuIcon>
					{t("topBar.menu.segmentationTools", "Segmentation Tools")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onRubySegment}>
						<NewMenuIcon>
							<TextAdd20Regular />
						</NewMenuIcon>
						{t("topBar.menu.rubySegment", "Ruby Segmentation")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenAdvancedSegmentation}>
						<NewMenuIcon>
							<TextGrammarCheckmark20Regular />
						</NewMenuIcon>
						{t("topBar.menu.advancedSegment", "Advanced Segmentation...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenLearnedSplits}>
						<NewMenuIcon>
							<History20Regular />
						</NewMenuIcon>
						{t("topBar.menu.learnedSplits", "Learned Splits...")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={menu.onSyncLineTimestamps}>
				<NewMenuIcon>
					<Clock20Regular />
				</NewMenuIcon>
				{t("topBar.menu.syncLineTimestamps", "Sync Line Timestamps")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onAutoDuetBySinger}>
				<NewMenuIcon>
					<People20Regular />
				</NewMenuIcon>
				{t("topBar.menu.autoDuetBySinger", "Auto Duet Based on Singer")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				<NewMenuIcon>
					<Timer20Regular />
				</NewMenuIcon>
				{t("topBar.menu.timeShift", "Time Shift...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTimeStretch}>
				<NewMenuIcon>
					<ArrowAutofitWidth20Regular />
				</NewMenuIcon>
				{t("topBar.menu.timeStretch", "Time Stretch...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onOpenTTMLChecklist}
				shortcut={getShortcut(menu.ttmlChecklistKey)}
			>
				<NewMenuIcon>
					<CheckmarkCircle20Regular />
				</NewMenuIcon>
				{t("topBar.menu.ttmlChecklist", "TTML Checklist...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenTTMLReview}
				shortcut={getShortcut(menu.ttmlReviewKey)}
			>
				<Flex align="center" gap="2">
					<Flag20Regular style={{ width: 15, height: 15, flexShrink: 0 }} />
					{t("topBar.menu.ttmlReview", "Review TTML...")}
				</Flex>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenGrammarCheck}>
				<NewMenuIcon>
					<TextGrammarCheckmark20Regular />
				</NewMenuIcon>
				{t("topBar.menu.grammarCheck", "Grammar and Spelling Check...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenGeniusLyricsRefresh}
				disabled={lyricLines.lyricLines.length === 0}
			>
				<NewMenuIcon>
					<History20Regular />
				</NewMenuIcon>
				{t("topBar.menu.refreshGeniusLyrics", "Refresh Lyrics from Genius...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenCensorWords}>
				<Flex align="center" gap="2">
					<Broom20Regular style={{ width: 15, height: 15, flexShrink: 0 }} />
					{t("topBar.menu.censorWords", "Search Bad Words & Clean Version…")}
				</Flex>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenStatsAndProfiles}>
				<NewMenuIcon>
					<People20Regular />
				</NewMenuIcon>
				{t("topBar.menu.statsAndProfiles", "User Profiles & Stats...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenSpotMatch}
				shortcut={getShortcut(menu.spotMatchKey)}
			>
				<NewMenuIcon>
					<Target20Regular />
				</NewMenuIcon>
				{t("topBar.menu.spotMatch", "SpotMatch (Alternate Spotify IDs)...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onDownloadAudio}>
				<NewMenuIcon>
					<ArrowDownload20Regular />
				</NewMenuIcon>
				{t("topBar.menu.downloadAudio", "Download Audio...")}
			</DropdownMenu.Item>
			{isTauri() && (
				<DropdownMenu.Item
					onSelect={() => {
						const metadata = lyricLines.metadata;
						const title = metadata.find(
							(m) => (m.key || "").toLowerCase() === "title",
						)?.value[0];
						const artist = metadata.find(
							(m) => (m.key || "").toLowerCase() === "artist",
						)?.value[0];
						const q = [artist, title].filter(Boolean).join(" ").trim();
						setDownloaderInitialQuery(q || null);
						openDownloader(true);
					}}
				>
					<NewMenuIcon>
						<Wrench20Regular />
					</NewMenuIcon>
					{t("topBar.menu.mediaDownloader", "Media Downloader (yt-dlp)...")}
				</DropdownMenu.Item>
			)}
			<DropdownMenu.Item onSelect={menu.onOpenLatencyTest}>
				<NewMenuIcon>
					<Timer20Regular />
				</NewMenuIcon>
				{t("settingsDialog.common.latencyTest", "Latency Test...")}
			</DropdownMenu.Item>

			{tools.length > 0 && <DropdownMenu.Separator />}
			{tools.map((tool) => (
				<DropdownMenu.Item
					key={tool.metadata.id}
					onSelect={onRunPluginTool(tool.metadata.id)}
				>
					{tool.metadata.name}
				</DropdownMenu.Item>
			))}
		</>
	);
};

export const ToolMenu = (props: ToolMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<NewMenuIcon>
						<Wrench20Regular />
					</NewMenuIcon>
					<Trans i18nKey="topBar.menu.tool">Tools</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<ToolMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button
						variant="ghost"
						className="topMenuBarButton"
						style={props.buttonStyle}
					>
						<Trans i18nKey="topBar.menu.tool">Tools</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
