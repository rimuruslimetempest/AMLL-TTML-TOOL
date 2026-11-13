import {
	ArrowUpRight16Regular,
	Edit24Regular,
	PanelRight24Filled,
	PanelRight24Regular,
	Play24Regular,
	Timer24Regular,
} from "@fluentui/react-icons";
import { Flex, SegmentedControl, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NewTitleBarCluster } from "$/components/AppShell/NewShellChrome";
import WindowControls from "$/components/WindowControls";
import { loadedAudioFileNameAtom } from "$/modules/audio/states/index.ts";
import {
	collabDialogOpenAtom,
	collabNameAtom,
	collabRoleAtom,
	collabSessionAtom,
} from "$/modules/collab/states";
import {
	formatTimerClock,
	formatTimerDuration,
} from "$/modules/project/timer/project-timer";
import {
	averageTTMLTimeSecondsAtom,
	currentProjectTimeSecondsAtom,
	isTimerInactiveAtom,
} from "$/modules/project/timer/states";
import {
	boykisserModeAtom,
	boykisserUnlockedAtom,
	geniusApiKeyAtom,
} from "$/modules/settings/states";
import {
	keyNextTabAtom,
	keyPrevTabAtom,
	keySwitchEditModeAtom,
	keySwitchPreviewModeAtom,
	keySwitchSyncModeAtom,
} from "$/states/keybindings.ts";
import {
	lyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { openExternal } from "$/utils/openExternal";
import { TopMenu } from "../TopMenu/index.tsx";
import {
	getIsSongLoaded,
	resolveGeniusDirectTargetUrl,
} from "./genius-shortcut";
import styles from "./NewTitleBar.module.css";

const roleKey: Record<string, string> = {
	host: "Host",
	editor: "Editor",
	commenter: "Commenter",
	viewer: "Viewer",
};

export const NewTitleBar: FC = () => {
	const [toolMode, setToolMode] = useAtom(toolModeAtom);
	const [showPreviewPanel, setShowPreviewPanel] = useAtom(showPreviewPanelAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const { t } = useTranslation();
	const [boykisserMode, setBoykisserMode] = useAtom(boykisserModeAtom);
	const [boykisserUnlocked] = useAtom(boykisserUnlockedAtom);
	const currentProjectTime = useAtomValue(currentProjectTimeSecondsAtom);
	const isTimerInactive = useAtomValue(isTimerInactiveAtom);
	const averageTime = useAtomValue(averageTTMLTimeSecondsAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const loadedAudioFileName = useAtomValue(loadedAudioFileNameAtom);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const collabName = useAtomValue(collabNameAtom);
	const collabSession = useAtomValue(collabSessionAtom);
	const collabRole = useAtomValue(collabRoleAtom);
	const setCollabDialogOpen = useSetAtom(collabDialogOpenAtom);

	const isApp = useMemo(() => {
		const isTauri =
			typeof window !== "undefined" &&
			(!!(window as any).__TAURI__ || !!import.meta.env.TAURI_ENV_PLATFORM);
		const isPwa =
			typeof window !== "undefined" &&
			(window.matchMedia("(display-mode: standalone)").matches ||
				(window.navigator as any).standalone);
		return isTauri || isPwa;
	}, []);
	const isUnlocked = !isApp || boykisserUnlocked;

	const isSongLoaded = useMemo(() => {
		return getIsSongLoaded({
			metadata: lyricLines.metadata,
			lyricLinesCount: lyricLines.lyricLines.length,
			loadedAudioFileName,
			saveFileName,
		});
	}, [lyricLines, loadedAudioFileName, saveFileName]);

	const handleOpenGenius = useCallback(async () => {
		if (!isSongLoaded) return;
		const targetUrl = await resolveGeniusDirectTargetUrl({
			metadata: lyricLines.metadata,
			loadedAudioFileName,
			saveFileName,
			apiKey: geniusApiKey,
		});
		void openExternal(targetUrl);
	}, [
		isSongLoaded,
		lyricLines.metadata,
		loadedAudioFileName,
		saveFileName,
		geniusApiKey,
	]);

	const onSwitchEditMode = useCallback(() => {
		setToolMode(ToolMode.Edit);
	}, [setToolMode]);
	const onSwitchSyncMode = useCallback(() => {
		setToolMode(ToolMode.Sync);
	}, [setToolMode]);
	const onSwitchPreviewMode = useCallback(() => {
		setToolMode(ToolMode.Preview);
	}, [setToolMode]);

	const onSwitchNextTab = useCallback(() => {
		if (document.querySelector('[role="dialog"]')) return;
		setToolMode((current) => {
			if (current === ToolMode.Edit) return ToolMode.Sync;
			if (current === ToolMode.Sync) return ToolMode.Preview;
			return ToolMode.Edit;
		});
	}, [setToolMode]);

	const onSwitchPrevTab = useCallback(() => {
		if (document.querySelector('[role="dialog"]')) return;
		setToolMode((current) => {
			if (current === ToolMode.Edit) return ToolMode.Preview;
			if (current === ToolMode.Preview) return ToolMode.Sync;
			return ToolMode.Edit;
		});
	}, [setToolMode]);

	useKeyBindingAtom(keySwitchEditModeAtom, onSwitchEditMode);
	useKeyBindingAtom(keySwitchSyncModeAtom, onSwitchSyncMode);
	useKeyBindingAtom(keySwitchPreviewModeAtom, onSwitchPreviewMode);
	useKeyBindingAtom(keyNextTabAtom, onSwitchNextTab);
	useKeyBindingAtom(keyPrevTabAtom, onSwitchPrevTab);

	const profileName = collabName.trim() || t("topBar.you", "You");
	const profileRole = collabRole
		? roleKey[collabRole] || collabRole
		: collabSession
			? t("topBar.connected", "In room")
			: t("topBar.solo", "Solo");
	const profileInitial = profileName.slice(0, 1).toUpperCase() || "?";

	const timerTooltip = (
		<div className={styles.timerTooltip}>
			<div>
				{t("topBar.timer.activeTime", "Active Time: {time}", {
					time: formatTimerDuration(currentProjectTime),
				})}
				{isTimerInactive ? (
					<span className={styles.timerIdle}>
						({t("topBar.timer.paused", "Idle")})
					</span>
				) : null}
			</div>
			{typeof averageTime === "number" && averageTime > 0 ? (
				<div className={styles.timerAverage}>
					{t("topBar.timer.average", "Avg Sync: {time}", {
						time: formatTimerDuration(averageTime),
					})}
				</div>
			) : null}
		</div>
	);

	return (
		<WindowControls
			startChildren={
				<div className={styles.start}>
					<TopMenu compactAt={1440} />
				</div>
			}
			titleChildren={
				<SegmentedControl.Root
					value={toolMode}
					onValueChange={(v) => setToolMode(v as ToolMode)}
					size="1"
					className={styles.modeSwitch}
				>
					<SegmentedControl.Item
						value={ToolMode.Edit}
						title={t("topBar.modeBtns.edit", "Edit")}
					>
						<span className={styles.modeItem}>
							<Edit24Regular />
							<span className={styles.modeLabel}>
								{t("topBar.modeBtns.edit", "Edit")}
							</span>
						</span>
					</SegmentedControl.Item>
					<SegmentedControl.Item
						value={ToolMode.Sync}
						title={t("topBar.modeBtns.sync", "Sync")}
					>
						<span className={styles.modeItem}>
							<Timer24Regular />
							<span className={styles.modeLabel}>
								{t("topBar.modeBtns.sync", "Sync")}
							</span>
						</span>
					</SegmentedControl.Item>
					<SegmentedControl.Item
						value={ToolMode.Preview}
						title={t("topBar.modeBtns.preview", "Preview")}
					>
						<span className={styles.modeItem}>
							<Play24Regular />
							<span className={styles.modeLabel}>
								{t("topBar.modeBtns.preview", "Preview")}
							</span>
						</span>
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			}
			endChildren={
				<Flex align="center" gap="1" className={styles.end}>
					<NewTitleBarCluster />
					<span className={styles.divider} aria-hidden="true" />
					<Tooltip content={timerTooltip}>
						<div
							className={styles.timerChip}
							style={{ opacity: isTimerInactive ? 0.68 : 1 }}
							aria-label={t("topBar.timer.activeTime", "Active Time: {time}", {
								time: formatTimerDuration(currentProjectTime),
							})}
						>
							<Timer24Regular className={styles.timerIcon} />
							<span className={styles.timerValue}>
								{formatTimerClock(currentProjectTime)}
							</span>
						</div>
					</Tooltip>
					{toolMode !== ToolMode.Preview ? (
						<Tooltip
							content={
								showPreviewPanel
									? t("topBar.menu.hidePreviewPanel", "Hide Side Preview Panel")
									: t("topBar.menu.showPreviewPanel", "Show Side Preview Panel")
							}
						>
							<button
								type="button"
								className={styles.iconButton}
								onClick={() => setShowPreviewPanel((prev) => !prev)}
								aria-label={
									showPreviewPanel
										? t(
												"topBar.menu.hidePreviewPanel",
												"Hide Side Preview Panel",
											)
										: t(
												"topBar.menu.showPreviewPanel",
												"Show Side Preview Panel",
											)
								}
								aria-pressed={showPreviewPanel}
								data-active={showPreviewPanel ? "true" : undefined}
							>
								{showPreviewPanel ? (
									<PanelRight24Filled />
								) : (
									<PanelRight24Regular />
								)}
							</button>
						</Tooltip>
					) : null}
					<Tooltip
						content={
							isSongLoaded
								? t("topBar.openInGenius", "Open on Genius")
								: t("topBar.noSongLoaded", "No song loaded")
						}
					>
						<button
							type="button"
							className={styles.geniusButton}
							onClick={handleOpenGenius}
							disabled={!isSongLoaded}
							aria-label={t("topBar.openInGenius", "Open on Genius")}
						>
							<span className={styles.geniusMark} aria-hidden="true">
								G
							</span>
							<ArrowUpRight16Regular className={styles.geniusArrow} />
						</button>
					</Tooltip>
					{collabSession ? (
						<Tooltip content={t("collab.profile", "Collaboration profile")}>
							<button
								type="button"
								className={styles.userChip}
								onClick={() => setCollabDialogOpen(true)}
								aria-label={t(
									"collab.openProfile",
									"Open collaboration profile",
								)}
							>
								<span className={styles.userAvatar} aria-hidden="true">
									{profileInitial}
								</span>
								<span className={styles.userMeta}>
									<span className={styles.userName}>{profileName}</span>
									<span className={styles.userRole}>{profileRole}</span>
								</span>
							</button>
						</Tooltip>
					) : null}
					{isUnlocked && !window.location.href.includes("spicylyrics.org") ? (
						<button
							type="button"
							className={styles.secretButton}
							onClick={() => setBoykisserMode(!boykisserMode)}
							title={t("topBar.boykisser", "boykisser")}
							aria-label={t("topBar.boykisser", "boykisser")}
						/>
					) : null}
				</Flex>
			}
			onSpacerClicked={() => {
				setSelectedLines((o) => o.clear());
				setSelectedWords((o) => o.clear());
			}}
		/>
	);
};
