import {
	Chat16Regular,
	CheckmarkCircle16Regular,
	History16Regular,
	Search16Regular,
	Translate16Regular,
} from "@fluentui/react-icons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	collabCommentsAtom,
	collabMembersAtom,
	collabPanelAtom,
	collabSessionAtom,
} from "$/modules/collab/states";
import { openCommentCount } from "$/modules/collab/model";
import {
	DEFAULT_UI_SCALE,
	mouseFreeModeAtom,
	uiScaleAtom,
} from "$/modules/settings/states";
import { focusModeAtom } from "$/modules/studio/state";
import { findReplaceStateAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import styles from "./NewStatusBar.module.css";

const SCALE_STEPS = [90, 100, 110, 125, 150];

export function NewStatusBar() {
	const { t } = useTranslation();
	const toolMode = useAtomValue(toolModeAtom);
	const lines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const session = useAtomValue(collabSessionAtom);
	const members = useAtomValue(collabMembersAtom);
	const comments = useAtomValue(collabCommentsAtom);
	const [panel, setPanel] = useAtom(collabPanelAtom);
	const [uiScale, setUiScale] = useAtom(uiScaleAtom);
	const [focusMode, setFocusMode] = useAtom(focusModeAtom);
	const mouseFreeMode = useAtomValue(mouseFreeModeAtom);
	const setFind = useSetAtom(findReplaceStateAtom);

	const modeLabel =
		toolMode === ToolMode.Edit
			? t("topBar.modeBtns.edit", "Edit")
			: toolMode === ToolMode.Sync
				? t("topBar.modeBtns.sync", "Sync")
				: toolMode === ToolMode.Preview
					? t("topBar.modeBtns.preview", "Preview")
					: t("topBar.modeBtns.review", "Review");

	const cycleScale = () => {
		const index = SCALE_STEPS.indexOf(uiScale);
		if (index === -1) {
			setUiScale(DEFAULT_UI_SCALE);
			return;
		}
		setUiScale(SCALE_STEPS[(index + 1) % SCALE_STEPS.length]);
	};

	const openFind = () => {
		setFind((previous) => ({
			...previous,
			open: true,
			replaceMode: false,
		}));
	};

	return (
		<footer
			className={styles.statusBar}
			data-ttml-chrome="statusbar"
			aria-label="Status bar"
		>
			<span className={styles.mode}>{modeLabel}</span>
			<span className={styles.separator} aria-hidden="true" />
			<span className={styles.meta}>
				{lines.lyricLines.length} {t("newShell.lines", "lines")}
			</span>
			{selectedLines.size > 0 || selectedWords.size > 0 ? (
				<span className={styles.meta}>
					{selectedLines.size > 0
						? `${selectedLines.size} ${t("newShell.linesSelected", "selected")}`
						: `${selectedWords.size} ${t("newShell.wordsSelected", "words")}`}
				</span>
			) : null}
			<span className={styles.spacer} />
			{session ? (
				<>
					<span className={styles.meta}>
						{members.length} {t("newShell.inRoom", "in room")}
					</span>
					<button
						type="button"
						className={styles.action}
						data-active={panel === "comments" ? "true" : undefined}
						onClick={() => setPanel("comments")}
						title={t("newShell.comments", "Comments")}
					>
						<Chat16Regular />
						<span>
							{openCommentCount(comments) > 99
								? "99+"
								: openCommentCount(comments)}
						</span>
					</button>
					<button
						type="button"
						className={styles.action}
						data-active={panel === "review" ? "true" : undefined}
						onClick={() => setPanel("review")}
						title={t("newShell.review", "Review")}
					>
						<CheckmarkCircle16Regular />
					</button>
					<button
						type="button"
						className={styles.action}
						data-active={panel === "translation" ? "true" : undefined}
						onClick={() => setPanel("translation")}
						title={t("newShell.translation", "Translate")}
					>
						<Translate16Regular />
					</button>
					<button
						type="button"
						className={styles.action}
						data-active={panel === "history" ? "true" : undefined}
						onClick={() => setPanel("history")}
						title={t("newShell.history", "History")}
					>
						<History16Regular />
					</button>
				</>
			) : null}
			<button
				type="button"
				className={styles.action}
				onClick={openFind}
				title={t("newShell.find", "Find")}
			>
				<Search16Regular />
				<span>{t("newShell.find", "Find")}</span>
			</button>
			<button
				type="button"
				className={styles.action}
				onClick={cycleScale}
				title={t("newShell.uiScale", "UI scale")}
			>
				{uiScale}%
			</button>
			{mouseFreeMode ? (
				<span className={styles.hint} title="Mouse-free mode is active">
					⌨ {t("newShell.mouseFree", "Mouse-free")}
				</span>
			) : null}
			{focusMode ? (
				<button
					type="button"
					className={styles.focusExit}
					onClick={() => setFocusMode(false)}
				>
					{t("newShell.leaveFocus", "Leave focus")} · Esc
				</button>
			) : null}
		</footer>
	);
}
