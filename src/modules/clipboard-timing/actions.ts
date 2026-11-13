import { toast } from "react-toastify";
import { currentTimeAtom } from "$/modules/audio/states";
import { can, denialMessage } from "$/modules/collab/permissions";
import {
	collabActiveAtom,
	collabLocksAtom,
	collabRoleAtom,
	collabSelfIdAtom,
} from "$/modules/collab/states";
import {
	lyricLinesAtom,
	newLyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { globalStore } from "$/states/store";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	applyPastePreview,
	buildLineFullClipboard,
	buildLineTextClipboard,
	buildLineTimingClipboard,
	buildPastePreview,
} from "./logic";
import {
	clipboardPayloadAtom,
	timingPasteDialogAtom,
} from "./states";

const TIMING_PERMISSION = "editTiming" as const;

function canPasteTiming(): boolean {
	if (!globalStore.get(collabActiveAtom)) return true;
	const role = globalStore.get(collabRoleAtom);
	if (can(role, TIMING_PERMISSION)) return true;
	toast.warn(denialMessage(role, TIMING_PERMISSION));
	return false;
}

export function selectedLineIds(): string[] {
	const selected = globalStore.get(selectedLinesAtom);
	if (selected.size > 0) return [...selected];
	return [];
}

export function firstSelectedLine() {
	const lyrics = globalStore.get(lyricLinesAtom).lyricLines;
	const ids = selectedLineIds();
	if (ids.length === 0) return lyrics[0];
	return lyrics.find((line) => line.id === ids[0]);
}

export function copyLineTiming(): void {
	const line = firstSelectedLine();
	if (!line) {
		toast.info("Select a line first.");
		return;
	}
	const payload = buildLineTimingClipboard(line);
	globalStore.set(clipboardPayloadAtom, payload);
	void navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => {});
	toast.success(
		`Copied timing for ${payload.words.filter((word) => word.endTime > word.startTime).length} word(s).`,
	);
}

export function copyLineText(): void {
	const line = firstSelectedLine();
	if (!line) {
		toast.info("Select a line first.");
		return;
	}
	const payload = buildLineTextClipboard(line);
	globalStore.set(clipboardPayloadAtom, payload);
	void navigator.clipboard?.writeText(payload.text).catch(() => {});
	toast.success("Copied line text.");
}

export function copyLineWithTiming(): void {
	const line = firstSelectedLine();
	if (!line) {
		toast.info("Select a line first.");
		return;
	}
	const payload = buildLineFullClipboard(line);
	globalStore.set(clipboardPayloadAtom, payload);
	void navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => {});
	toast.success("Copied line with timing.");
}

export function openTimingPaste(
	mode: "position" | "stretch",
	relative = false,
): void {
	if (!canPasteTiming()) return;
	const line = firstSelectedLine();
	if (!line) {
		toast.info("Select the line that should receive the timing.");
		return;
	}
	globalStore.set(timingPasteDialogAtom, {
		open: true,
		mode,
		relative,
		targetLineId: line.id,
	});
}

/** Paste line text as a brand-new line after the selection. */
export function pasteAsNewLine(): void {
	if (!canPasteTiming()) return;
	const payload = globalStore.get(clipboardPayloadAtom);
	if (!payload) {
		toast.info("Copy a line first.");
		return;
	}
	const lyrics = globalStore.get(lyricLinesAtom);
	const selected = globalStore.get(selectedLinesAtom);
	const selectedIndex = lyrics.lyricLines.findIndex((line) =>
		selected.has(line.id),
	);
	const anchorIndex =
		selectedIndex >= 0 ? selectedIndex : lyrics.lyricLines.length - 1;
	const anchor = lyrics.lyricLines[anchorIndex];
	const line = {
		...newLyricLine(),
		isBG: anchor?.isBG ?? false,
		isDuet: anchor?.isDuet ?? false,
		agent: anchor?.agent,
		language: anchor?.language,
		translatedLyric: payload.kind === "line-full" ? payload.translatedLyric : "",
		romanLyric: payload.kind === "line-full" ? payload.romanLyric : "",
	};
	const tokens = payload.text.split(/(\s+)/).filter(Boolean);
	line.words = tokens.map((token) => ({
		...newLyricWord(),
		word: token,
		needsReview: true,
	}));
	line.startTime = 0;
	line.endTime = 0;
	const nextLines = [...lyrics.lyricLines];
	nextLines.splice(anchorIndex + 1, 0, line);
	globalStore.set(lyricLinesAtom, { ...lyrics, lyricLines: nextLines });
	globalStore.set(selectedLinesAtom, new Set([line.id]));
	globalStore.set(selectedWordsAtom, new Set());
	toast.success("Pasted as a new line. Add its timing when you are ready.");
}

/** Replaces the selected line's text after an explicit confirmation. */
export function pasteLineText(): void {
	if (!canPasteTiming()) return;
	const payload = globalStore.get(clipboardPayloadAtom);
	if (!payload) {
		toast.info("Copy a line first.");
		return;
	}
	const line = firstSelectedLine();
	if (!line) {
		toast.info("Select the line that should receive the text.");
		return;
	}
	if (
		!window.confirm(
			"Replace this line's text? Its word timing and split points will be removed, and the line will be marked for review.",
		)
	) {
		return;
	}
	const lyrics = globalStore.get(lyricLinesAtom);
	const tokens = payload.text.split(/(\s+)/).filter(Boolean);
	const nextLines = lyrics.lyricLines.map((candidate) => {
		if (candidate.id !== line.id) return candidate;
		return {
			...candidate,
			words: tokens.map((token) => ({
				...newLyricWord(),
				word: token,
				needsReview: true,
			})),
			startTime: 0,
			endTime: 0,
			isLineSynced: false,
		};
	});
	globalStore.set(lyricLinesAtom, { ...lyrics, lyricLines: nextLines });
	toast.success("Line text pasted. Its timing is empty and marked for review.");
}

export function isTargetLineLocked(lineId: string): boolean {
	if (!globalStore.get(collabActiveAtom)) return false;
	const selfId = globalStore.get(collabSelfIdAtom);
	const now = Date.now();
	return globalStore
		.get(collabLocksAtom)
		.some(
			(lock) =>
				lock.lineId === lineId &&
				lock.clientId !== selfId &&
				lock.expiresAt > now,
		);
}

/** Used by the dialog; returns true when the paste was applied. */
export function commitTimingPaste(
	targetLineId: string,
	preview: ReturnType<typeof buildPastePreview>,
): boolean {
	if (!canPasteTiming()) return false;
	if (isTargetLineLocked(targetLineId)) {
		toast.warn(
			"Someone else is editing that line right now. Try again when their lock expires.",
		);
		return false;
	}
	const lyrics = globalStore.get(lyricLinesAtom);
	let changed = false;
	const nextLines = lyrics.lyricLines.map((line) => {
		if (line.id !== targetLineId) return line;
		changed = true;
		return applyPastePreview(line, preview);
	});
	if (!changed) return false;
	globalStore.set(lyricLinesAtom, { ...lyrics, lyricLines: nextLines });
	toast.success("Timing pasted. Every pasted word is marked for review.");
	return true;
}

/** Relative paste helper shared by the menu and the dialog. */
export function relativeStartFor(lineId: string): number {
	const lyrics = globalStore.get(lyricLinesAtom).lyricLines;
	const target = lyrics.find((line) => line.id === lineId);
	if (target && target.startTime > 0) return target.startTime;
	return globalStore.get(currentTimeAtom) ?? 0;
}

export function buildPasteForTarget(
	targetLineId: string,
	mode: "position" | "stretch",
	offsetMs: number,
	relative: boolean,
): { preview: ReturnType<typeof buildPastePreview>; targetLineId: string } | null {
	const payload = globalStore.get(clipboardPayloadAtom);
	if (!payload || payload.kind !== "line-timing") return null;
	const target = globalStore
		.get(lyricLinesAtom)
		.lyricLines.find((line) => line.id === targetLineId);
	if (!target) return null;
	const preview = buildPastePreview(target, payload, {
		mode,
		offsetMs,
		relative,
		startAt: relativeStartFor(targetLineId),
	});
	return { preview, targetLineId };
}

export function resetNewProjectClipboard(): void {
	globalStore.set(clipboardPayloadAtom, null);
	globalStore.set(newLyricLinesAtom);
}
