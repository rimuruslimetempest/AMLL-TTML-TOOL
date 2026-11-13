import { uid } from "uid";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";

export type NewLineInsertionMode = "afterSelected" | "end";

export interface NewLineInsertionOptions {
	selectedLineIds: ReadonlySet<string>;
	/** Current audio position in milliseconds. */
	currentTime: number;
	mode: NewLineInsertionMode;
}

/**
 * Finds where a brand new line belongs. The line array order is the single
 * source of truth for every view, so this deliberately never looks at
 * timestamps to reorder anything.
 *
 * Order of preference:
 * 1. directly after the last selected line;
 * 2. directly after the line under the playhead;
 * 3. at the end when there is no sensible anchor.
 */
export function resolveNewLineInsertionIndex(
	lines: readonly Pick<LyricLine, "id" | "startTime" | "endTime">[],
	{ selectedLineIds, currentTime, mode }: NewLineInsertionOptions,
): number {
	if (mode === "end" || lines.length === 0) return lines.length;

	// Use the last selected line in document order. This makes a multi-line
	// selection behave predictably: the new line follows the whole selection.
	for (let index = lines.length - 1; index >= 0; index--) {
		if (selectedLineIds.has(lines[index].id)) return index + 1;
	}

	if (Number.isFinite(currentTime) && currentTime > 0) {
		let lastStartedIndex = -1;
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (line.startTime <= currentTime) lastStartedIndex = index;
			if (
				line.startTime <= currentTime &&
				line.endTime > line.startTime &&
				currentTime <= line.endTime
			) {
				return index + 1;
			}
		}
		if (lastStartedIndex >= 0) return lastStartedIndex + 1;
	}

	return lines.length;
}

function cloneWordWithoutTiming(word: LyricWord): LyricWord {
	return {
		...word,
		id: uid(),
		startTime: 0,
		endTime: 0,
		ruby: word.ruby?.map((ruby) => ({
			...ruby,
			startTime: 0,
			endTime: 0,
		})),
	};
}

/**
 * Copies a line's text and metadata. By default the copy is deliberately
 * unsynced so it cannot be mistaken for a finished line; "Duplicate with
 * timing" keeps the original timestamps instead.
 */
export function cloneLyricLine(
	line: LyricLine,
	{ keepTiming }: { keepTiming: boolean },
): LyricLine {
	const copy: LyricLine = {
		...line,
		id: uid(),
		words: line.words.map((word) =>
			keepTiming ? { ...word, id: uid() } : cloneWordWithoutTiming(word),
		),
	};
	delete copy.endTimeLink;
	if (!keepTiming) {
		copy.startTime = 0;
		copy.endTime = 0;
		copy.isLineSynced = false;
		copy.ignoreSync = false;
	}
	return copy;
}

/** Insert a fresh line and preserve the anchor line's section grouping. */
export function insertNewLineAt(
	lyrics: TTMLLyric,
	index: number,
	newLine: LyricLine,
): LyricLine {
	const anchor = lyrics.lyricLines[index - 1];
	if (anchor?.sectionId) newLine.sectionId = anchor.sectionId;
	if (anchor?.geniusHeader) newLine.geniusHeader = anchor.geniusHeader;
	lyrics.lyricLines.splice(index, 0, newLine);
	return newLine;
}

/** Duplicate selected lines directly after the selection, in original order. */
export function duplicateLinesAfterSelection(
	lyrics: TTMLLyric,
	selectedLineIds: ReadonlySet<string>,
	{ keepTiming }: { keepTiming: boolean },
): string[] {
	if (selectedLineIds.size === 0) return [];
	const sourceLines = lyrics.lyricLines.filter((line) =>
		selectedLineIds.has(line.id),
	);
	if (sourceLines.length === 0) return [];

	let lastSourceIndex = -1;
	for (let index = 0; index < lyrics.lyricLines.length; index++) {
		if (selectedLineIds.has(lyrics.lyricLines[index].id)) {
			lastSourceIndex = index;
		}
	}
	if (lastSourceIndex < 0) return [];

	const copies = sourceLines.map((line) =>
		cloneLyricLine(line, { keepTiming }),
	);
	lyrics.lyricLines.splice(lastSourceIndex + 1, 0, ...copies);
	return copies.map((line) => line.id);
}
