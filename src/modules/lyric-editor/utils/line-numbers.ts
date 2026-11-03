import type { LyricLine } from "$/types/ttml";

export type LineNumberSource = Pick<LyricLine, "isBG">;

/**
 * Numbers lines exactly like the editor: the first line always counts, and
 * background lines share the number of the line they belong to.
 */
export function getLineDisplayNumbers(
	lines: readonly LineNumberSource[],
): number[] {
	let current = 0;
	return lines.map((line, index) => {
		if (index === 0 || !line.isBG) current += 1;
		return current;
	});
}

/** Returns the first raw index showing this number (the parent of a BG run). */
export function findLineIndexByDisplayNumber(
	lines: readonly LineNumberSource[],
	displayNumber: number,
): number {
	return getLineDisplayNumbers(lines).indexOf(displayNumber);
}