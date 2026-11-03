import { ToolMode } from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";

export const shouldAutoCenterSelection = (toolMode: ToolMode) =>
	toolMode === ToolMode.Sync;

/** The first selected line in document order is the line mode switches follow. */
export const getPrimarySelectedLineId = (
	lyricLines: readonly Pick<LyricLine, "id">[],
	selectedLineIds: ReadonlySet<string>,
): string | null => {
	for (const line of lyricLines) {
		if (selectedLineIds.has(line.id)) return line.id;
	}
	return null;
};

export const getLineIndexById = (
	lyricLines: readonly Pick<LyricLine, "id">[],
	lineId: string,
): number => lyricLines.findIndex((line) => line.id === lineId);

export const getLineIdAtClampedIndex = (
	lyricLines: readonly Pick<LyricLine, "id">[],
	index: number,
): string | null => {
	if (lyricLines.length === 0) return null;
	const clampedIndex = Math.min(Math.max(index, 0), lyricLines.length - 1);
	return lyricLines[clampedIndex]?.id ?? null;
};

/** Finds the nearest line that survives a delete, keeping the old position. */
export const getNearestRemainingLineId = (
	lyricLines: readonly Pick<LyricLine, "id">[],
	removedLineIds: ReadonlySet<string>,
	preferredIndex: number,
): string | null => {
	const remainingLines = lyricLines.filter(
		(line) => !removedLineIds.has(line.id),
	);
	return getLineIdAtClampedIndex(remainingLines, preferredIndex);
};
