import { useAtom, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import { useCommand } from "$/modules/keyboard/hooks";
import {
	cmdCommandPalette,
	cmdFocusMode,
	cmdReviewCockpit,
	cmdWorkspaceHome,
} from "$/modules/keyboard/commands";
import { RtlAndAnnouncer } from "$/modules/accessibility/RtlAndAnnouncer";
import { CommandPalette } from "./CommandPalette";
import { PluginStudioDialog } from "./PluginStudio";
import { ReviewCockpit } from "./ReviewCockpit";
import { ThemeStudioDialog } from "./ThemeStudio";
import { WorkspaceLayoutsDialog } from "./WorkspaceLayouts";
import {
	CrashRecoveryDialog,
	DiffDialog,
	WorkspaceHomeDialog,
} from "./WorkspaceChrome";
import {
	activeWorkspaceTabAtom,
	commandPaletteOpenAtom,
	crashRecoveryAtom,
	focusModeAtom,
	lastBackupInfoAtom,
	reviewCockpitOpenAtom,
	workspaceHomeOpenAtom,
	workspaceTabsAtom,
} from "./state";
import { lyricLinesAtom } from "$/states/main";
import {
	activateWorkspaceTab,
	detectInterruptedSession,
	markSessionClean,
	writeSessionBackup,
	writeSessionSnapshot,
} from "./workspace";
import styles from "./studio.module.css";

export function StudioOverlays() {
	const store = useStore();
	const [paletteOpen, setPaletteOpen] = useAtom(commandPaletteOpenAtom);
	const [reviewOpen, setReviewOpen] = useAtom(reviewCockpitOpenAtom);
	const [homeOpen, setHomeOpen] = useAtom(workspaceHomeOpenAtom);
	const [focusMode, setFocusMode] = useAtom(focusModeAtom);
	const setLastBackup = useSetAtom(lastBackupInfoAtom);

	useCommand(cmdCommandPalette, () => setPaletteOpen(true));
	useCommand(cmdFocusMode, () => setFocusMode((value) => !value));
	useCommand(cmdWorkspaceHome, () => setHomeOpen((value) => !value));
	useCommand(cmdReviewCockpit, () => setReviewOpen((value) => !value));

	// Session recovery: keep a dirty snapshot, a clean marker on normal close,
	// and rolling backups with an integrity checksum.
	useEffect(() => {
		detectInterruptedSession(store);
		// Restore the last tab even when the Classic UI is active, so a session
		// survives a UI switch or a crash without opening the workspace dialog.
		if (
			!store.get(crashRecoveryAtom) &&
			!store.get(activeWorkspaceTabAtom) &&
			store.get(lyricLinesAtom).lyricLines.length === 0
		) {
			const tabs = store.get(workspaceTabsAtom);
			const last = tabs[tabs.length - 1];
			if (last) activateWorkspaceTab(store, last.id);
		}
		const initialBackup = writeSessionBackup(store);
		if (initialBackup) {
			setLastBackup({
				savedAt: initialBackup.savedAt,
				ok: true,
				size: initialBackup.size,
			});
		}
		writeSessionSnapshot(store, false);
		const snapshotTimer = window.setInterval(() => {
			writeSessionSnapshot(store, false);
		}, 12000);
		const backupTimer = window.setInterval(() => {
			const backup = writeSessionBackup(store);
			if (backup) {
				setLastBackup({
					savedAt: backup.savedAt,
					ok: true,
					size: backup.size,
				});
			}
		}, 15 * 60 * 1000);
		const onBeforeUnload = () => markSessionClean();
		window.addEventListener("beforeunload", onBeforeUnload);
		window.addEventListener("pagehide", onBeforeUnload);
		return () => {
			window.clearInterval(snapshotTimer);
			window.clearInterval(backupTimer);
			window.removeEventListener("beforeunload", onBeforeUnload);
			window.removeEventListener("pagehide", onBeforeUnload);
		};
	}, [store, setLastBackup]);

	useEffect(() => {
		document.documentElement.dataset.focusMode = focusMode ? "true" : "false";
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && focusMode) {
				setFocusMode(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [focusMode, setFocusMode]);

	const anyOverlay = paletteOpen || reviewOpen || homeOpen;

	return (
		<>
			<RtlAndAnnouncer />
			<CommandPalette />
			<ReviewCockpit />
			<ThemeStudioDialog />
			<WorkspaceLayoutsDialog />
			<PluginStudioDialog />
			<WorkspaceHomeDialog />
			<CrashRecoveryDialog />
			<DiffDialog />
			{focusMode ? (
				<button
					type="button"
					className={styles.focusExit}
					onClick={() => setFocusMode(false)}
					aria-label="Leave focus mode"
				>
					Leave focus mode · Esc
				</button>
			) : null}
			{!anyOverlay && focusMode ? (
				<div className={styles.srOnly} aria-live="polite">
					Focus mode is on. Press Escape to leave.
				</div>
			) : null}
		</>
	);
}

export { useWorkspaceSession } from "./WorkspaceChrome";
