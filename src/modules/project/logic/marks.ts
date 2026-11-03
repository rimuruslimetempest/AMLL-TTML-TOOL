import type { Mark, TTMLLyric } from "$/types/ttml";

/** Clicks within this distance of an existing mark toggle it instead of adding. */
export const MARK_TOGGLE_TOLERANCE_MS = 150;

/**
 * Adds a mark at `timeMs`, or removes the nearby mark when one already exists.
 * Marks stay sorted so the waveform and cue list can walk them directly.
 */
export function toggleMarkAt(
	lyric: TTMLLyric,
	timeMs: number,
	toleranceMs = MARK_TOGGLE_TOLERANCE_MS,
): TTMLLyric {
	const marks = lyric.marks ?? [];
	const existingIndex = marks.findIndex(
		(mark) => Math.abs(mark.timeMs - timeMs) < toleranceMs,
	);
	if (existingIndex !== -1) {
		return {
			...lyric,
			marks: marks.filter((_, index) => index !== existingIndex),
		};
	}
	const marksNext = [...marks, { timeMs }].sort((a, b) => a.timeMs - b.timeMs);
	return { ...lyric, marks: marksNext };
}

/** Patches the mark whose time exactly matches `timeMs`. */
export function updateMarkAt(
	lyric: TTMLLyric,
	timeMs: number,
	patch: Partial<Mark>,
): TTMLLyric {
	const marks = lyric.marks ?? [];
	const next = marks.map((mark) =>
		mark.timeMs === timeMs ? { ...mark, ...patch } : mark,
	);
	return { ...lyric, marks: next };
}
