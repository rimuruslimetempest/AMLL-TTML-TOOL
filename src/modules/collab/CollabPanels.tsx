import { Dialog, Spinner, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom } from "$/modules/audio/states";
import {
	lyricLinesAtom,
	projectIdAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { globalStore } from "$/states/store";
import { collabClient } from "./client";
import { CommentsPanel } from "./CommentsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { MembersPanel } from "./MembersPanel";
import {
	loadProjectCollabData,
	saveProjectCollabData,
} from "./project-data";
import { ReviewPanel } from "$/modules/review/ReviewPanel";
import { RoomSplitsPanel } from "./RoomSplitsPanel";
import { can } from "./permissions";
import { TranslationEditor } from "$/modules/translation/TranslationEditor";
import {
	romanizationLanguageAtom,
	translationLanguageAtom,
} from "$/modules/translation/states";
import {
	collabActiveAtom,
	collabCommentsAtom,
	collabFollowAtom,
	collabInteractionAtom,
	collabKickedAtom,
	collabPauseIncomingAtom,
	collabPeerFocusAtom,
	collabPendingJoinAtom,
	collabPermissionNoticeAtom,
	collabPanelAtom,
	collabHistoryAtom,
	collabRestorePointsAtom,
	collabReviewMarksAtom,
	collabRoleAtom,
	collabSplitDictionaryAtom,
} from "./states";
import { AvatarDot } from "./ui";
import styles from "./collab-ui.module.css";

function FollowBanner() {
	const [follow, setFollow] = useAtom(collabFollowAtom);
	if (!follow) return null;
	return (
		<div className={styles.banner} data-follow-banner>
			<AvatarDot member={{ name: follow.name, color: follow.color }} size={20} />
			<Text size="2" style={{ flex: 1, minWidth: 0 }}>
				Following <strong>{follow.name}</strong>
			</Text>
			<label
				style={{
					display: "flex",
					alignItems: "center",
					gap: 4,
					fontSize: 12,
				}}
			>
				<input
					type="checkbox"
					checked={follow.followPlayback}
					onChange={(event) =>
						setFollow({
							...follow,
							followPlayback: event.currentTarget.checked,
						})
					}
				/>
				Playback
			</label>
			<button
				type="button"
				onClick={() => setFollow(null)}
				style={{
					border: "none",
					borderRadius: 6,
					padding: "3px 8px",
					cursor: "pointer",
					background: "var(--gray-a4)",
					color: "inherit",
				}}
			>
				Stop
			</button>
		</div>
	);
}

function PendingJoin() {
	const [pending, setPending] = useAtom(collabPendingJoinAtom);
	if (!pending) return null;
	return (
		<div className={styles.overlay}>
			<div className={styles.overlayCard}>
				<Text size="3" weight="bold" as="div">
					Waiting for the host
				</Text>
				<Text size="2" color="gray" as="p">
					This room asks the host to approve each person before they join. Keep
					this window open.
				</Text>
				<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
					<Spinner size="1" />
					<button
						type="button"
						onClick={() => {
							collabClient.stop();
							setPending(false);
						}}
						style={{
							border: "1px solid var(--gray-a5)",
							borderRadius: 6,
							padding: "4px 10px",
							background: "transparent",
							color: "inherit",
							cursor: "pointer",
						}}
					>
						Leave
					</button>
				</div>
			</div>
		</div>
	);
}

function KickedDialog() {
	const [kicked, setKicked] = useAtom(collabKickedAtom);
	return (
		<Dialog.Root
			open={Boolean(kicked)}
			onOpenChange={(open) => {
				if (!open) setKicked(null);
			}}
		>
			<Dialog.Content maxWidth="440px">
				<Dialog.Title>You left the room</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{kicked ?? ""} Your local project and notes are still on this device.
				</Dialog.Description>
				<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
					<button
						type="button"
						onClick={() => setKicked(null)}
						style={{
							border: "none",
							borderRadius: 6,
							padding: "6px 14px",
							background: "var(--accent-9)",
							color: "var(--accent-contrast)",
							cursor: "pointer",
						}}
					>
						Continue locally
					</button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}

function FocusLineScroller() {
	useEffect(() => {
		const onFocusLine = (event: Event) => {
			const lineId = (event as CustomEvent<{ lineId: string }>).detail?.lineId;
			if (!lineId) return;
			requestAnimationFrame(() => {
				const element = document.querySelector(
					`[data-lyric-line-id="${CSS.escape(lineId)}"]`,
				);
				element?.scrollIntoView({ block: "center", behavior: "smooth" });
			});
		};
		window.addEventListener("ttml:focus-line", onFocusLine);
		return () => window.removeEventListener("ttml:focus-line", onFocusLine);
	}, []);
	return null;
}

function PermissionToast() {
	const [notice, setNotice] = useAtom(collabPermissionNoticeAtom);
	useEffect(() => {
		if (!notice) return;
		toast.warn(notice, { toastId: `collab-permission-${notice}` });
		const timer = setTimeout(() => setNotice(null), 400);
		return () => clearTimeout(timer);
	}, [notice, setNotice]);
	return null;
}

/** Follow another person without stealing their selection when paused. */
function FollowDriver() {
	const follow = useAtomValue(collabFollowAtom);
	const focus = useAtomValue(collabPeerFocusAtom);
	const paused = useAtomValue(collabPauseIncomingAtom);
	const interaction = useAtomValue(collabInteractionAtom);
	const setSelection = useSetAtom(collabFollowAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const lastLine = useRef<string | null>(null);
	const lyrics = useAtomValue(lyricLinesAtom);

	useEffect(() => {
		if (!follow || !focus || focus.from !== follow.memberId) return;
		if (paused || interaction) return;
		const line = lyrics.lyricLines.find((item) => item.id === focus.lineId);
		if (!line) return;
		const lineChanged = lastLine.current !== focus.lineId;
		lastLine.current = focus.lineId;
		globalStore.set(selectedLinesAtom, new Set([focus.lineId]));
		globalStore.set(
			selectedWordsAtom,
			new Set(focus.wordId ? [focus.wordId] : []),
		);
		if (
			follow.followPlayback &&
			playing &&
			lineChanged &&
			audioEngine.musicLoaded &&
			line.startTime >= 0
		) {
			audioEngine.seekMusic(line.startTime / 1000);
		}
	}, [follow, focus, paused, interaction, playing, lyrics]);

	useEffect(() => {
		if (!follow) return;
		const stop = () => setSelection(null);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") stop();
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest("[data-follow-banner]")) return;
			stop();
		};
		const onWheel = () => stop();
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("wheel", onWheel, { passive: true });
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("wheel", onWheel);
		};
	}, [follow, setSelection]);

	return null;
}

/** Mirrors comments, review marks, and translation languages into project notes. */
function ProjectNotesBridge() {
	const projectId = useAtomValue(projectIdAtom);
	const comments = useAtomValue(collabCommentsAtom);
	const reviewMarks = useAtomValue(collabReviewMarksAtom);
	const history = useAtomValue(collabHistoryAtom);
	const restorePoints = useAtomValue(collabRestorePointsAtom);
	const translationLanguage = useAtomValue(translationLanguageAtom);
	const romanizationLanguage = useAtomValue(romanizationLanguageAtom);
	const setComments = useSetAtom(collabCommentsAtom);
	const setReviewMarks = useSetAtom(collabReviewMarksAtom);
	const setHistory = useSetAtom(collabHistoryAtom);
	const setRestorePoints = useSetAtom(collabRestorePointsAtom);
	const setTranslationLanguage = useSetAtom(translationLanguageAtom);
	const setRomanizationLanguage = useSetAtom(romanizationLanguageAtom);
	const loaded = useRef<string | null>(null);

	useEffect(() => {
		const data = loadProjectCollabData(projectId);
		setComments(data?.comments ?? []);
		setReviewMarks(data?.reviewMarks ?? []);
		setHistory(data?.history ?? []);
		setRestorePoints(data?.restorePoints ?? []);
		setTranslationLanguage(data?.translationLanguage ?? "");
		setRomanizationLanguage(data?.romanizationLanguage ?? "");
		loaded.current = projectId;
	}, [
		projectId,
		setComments,
		setReviewMarks,
		setHistory,
		setRestorePoints,
		setTranslationLanguage,
		setRomanizationLanguage,
	]);

	useEffect(() => {
		if (loaded.current !== projectId) return;
		const timer = setTimeout(() => {
			saveProjectCollabData(projectId, {
				version: 1,
				comments,
				reviewMarks,
				history,
				restorePoints,
				translationLanguage,
				romanizationLanguage,
				savedAt: Date.now(),
			});
		}, 600);
		return () => clearTimeout(timer);
	}, [
		projectId,
		comments,
		reviewMarks,
		history,
		restorePoints,
		translationLanguage,
		romanizationLanguage,
	]);

	return null;
}

function RoomSplitsLauncher() {
	const active = useAtomValue(collabActiveAtom);
	const role = useAtomValue(collabRoleAtom);
	const [panel, setPanel] = useAtom(collabPanelAtom);
	const splits = useAtomValue(collabSplitDictionaryAtom);
	if (!active || panel || !can(role, "viewRoomSplits")) return null;
	return (
		<button
			type="button"
			onClick={() => setPanel("splits")}
			style={{
				position: "fixed",
				left: 12,
				bottom: 84,
				zIndex: 34,
				border: "1px solid var(--gray-a5)",
				borderRadius: 999,
				padding: "5px 12px",
				background: "var(--color-panel-solid)",
				color: "inherit",
				cursor: "pointer",
				fontSize: 12,
			}}
		>
			Room splits ({splits.length})
		</button>
	);
}

export function CollabPanels() {
	const [panel, setPanel] = useAtom(collabPanelAtom);
	const role = useAtomValue(collabRoleAtom);
	const close = () => setPanel(null);

	return (
		<>
			<ProjectNotesBridge />
			<FollowDriver />
			<FocusLineScroller />
			<FollowBanner />
			<PendingJoin />
			<KickedDialog />
			<PermissionToast />
			<RoomSplitsLauncher />
			{panel === "splits" ? <RoomSplitsPanel onClose={close} /> : null}
			{panel === "members" ? <MembersPanel onClose={close} /> : null}
			{panel === "comments" ? <CommentsPanel onClose={close} /> : null}
			{panel === "history" ? <HistoryPanel onClose={close} /> : null}
			{panel === "review" ? <ReviewPanel onClose={close} /> : null}
			{panel === "translation" ? <TranslationEditor onClose={close} /> : null}
			{panel === "members" && !role ? (
				<div className={styles.overlay} onClick={close}>
					<div className={styles.overlayCard}>
						<Text as="p" size="2">
							Join or host a room to manage people and invites.
						</Text>
					</div>
				</div>
			) : null}
		</>
	);
}
