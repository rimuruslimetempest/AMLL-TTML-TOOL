import { describe, expect, it } from "vitest";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import {
	type LyricLine,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	applyGeniusRefreshPlan,
	buildGeniusRefreshPlan,
	extractGeniusLyricLines,
	getGeniusRefreshLineText,
} from "./lyrics-refresh";

const segmentationConfig: SegmentationConfig = {
	engine: "prosodic",
	resplitWords: true,
	splitCJK: true,
	splitEnglish: false,
	punctuationMode: "merge",
	punctuationWeight: 0.2,
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
};

const word = (
	id: string,
	text: string,
	startTime: number,
	endTime: number,
) => ({
	...newLyricWord(),
	id,
	word: text,
	startTime,
	endTime,
});

const line = (
	id: string,
	text: string,
	startTime: number,
	endTime: number,
	words = [word(`${id}-word`, text, startTime, endTime)],
): LyricLine => ({
	...newLyricLine(),
	id,
	startTime,
	endTime,
	words,
});

const backgroundLine = (
	id: string,
	text: string,
	startTime: number,
	endTime: number,
): LyricLine => ({
	...line(id, text, startTime, endTime),
	isBG: true,
});

const lyrics = (...lines: LyricLine[]): TTMLLyric => ({
	metadata: [],
	lyricLines: lines,
});

describe("extractGeniusLyricLines", () => {
	it("removes section labels, blank lines, and embed chrome", () => {
		expect(
			extractGeniusLyricLines(
				"[Verse 1: Someone]\nFirst line\n\n  Second line  \nYou might also like\nEmbed",
			),
		).toEqual(["First line", "Second line"]);
	});
});

describe("Genius lyric refresh", () => {
	it("reuses exact line and word timestamps when the word count is unchanged", () => {
		const oldLine = line("line-1", "Hello world", 1000, 3000, [
			word("word-1", "Hello ", 1000, 1800),
			word("word-2", "world", 1800, 3000),
		]);
		const current = lyrics(oldLine);
		const plan = buildGeniusRefreshPlan(current, "Hello there");

		expect(plan.changedCount).toBe(1);
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: false,
			segmentationConfig,
		});
		const refreshed = result.lyrics.lyricLines[0];

		expect(refreshed.startTime).toBe(1000);
		expect(refreshed.endTime).toBe(3000);
		expect(refreshed.words.map((item) => item.word).join("")).toBe(
			"Hello there",
		);
		expect(
			refreshed.words.map((item) => [item.startTime, item.endTime]),
		).toEqual([
			[1000, 1800],
			[1800, 3000],
		]);
	});

	it("preserves line timestamps and inserts an untimed new line", () => {
		const first = line("line-1", "First line", 1000, 2000);
		const last = line("line-2", "Last line", 3000, 4000);
		const current = lyrics(first, last);
		const plan = buildGeniusRefreshPlan(
			current,
			"First line\nBrand new line\nLast line",
		);

		expect(plan.addedCount).toBe(1);
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});

		expect(result.lyrics.lyricLines).toHaveLength(3);
		expect(result.lyrics.lyricLines.map(getGeniusRefreshLineText)).toEqual([
			"First line",
			"Brand new line",
			"Last line",
		]);
		expect(result.lyrics.lyricLines[0].startTime).toBe(1000);
		expect(result.lyrics.lyricLines[0].endTime).toBe(2000);
		expect(result.lyrics.lyricLines[1].startTime).toBe(0);
		expect(result.lyrics.lyricLines[1].endTime).toBe(0);
		expect(result.lyrics.lyricLines[2].startTime).toBe(3000);
		expect(result.lyrics.lyricLines[2].endTime).toBe(4000);
	});

	it("keeps added and removed lines out of the update unless structural changes are enabled", () => {
		const current = lyrics(
			line("line-1", "First line", 1000, 2000),
			line("line-2", "Last line", 3000, 4000),
		);
		const plan = buildGeniusRefreshPlan(
			current,
			"First line\nBrand new line\nLast line",
		);
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: false,
			segmentationConfig,
		});

		expect(result.lyrics.lyricLines).toHaveLength(2);
		expect(result.lyrics.lyricLines[0].startTime).toBe(1000);
		expect(result.lyrics.lyricLines[1].startTime).toBe(3000);
	});

	it("removes missing lines without changing the timestamps of the remaining lines", () => {
		const current = lyrics(
			line("line-1", "One", 1000, 2000),
			line("line-2", "Two", 2000, 3000),
			line("line-3", "Three", 3000, 4000),
		);
		const plan = buildGeniusRefreshPlan(current, "One\nThree");
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});

		expect(result.lyrics.lyricLines.map(getGeniusRefreshLineText)).toEqual([
			"One",
			"Three",
		]);
		expect(result.lyrics.lyricLines.map((item) => item.startTime)).toEqual([
			1000, 3000,
		]);
		expect(result.removedCount).toBe(1);
	});

	it("reports when the current lyrics already match", () => {
		const current = lyrics(line("line-1", "Same line", 1000, 2000));
		const plan = buildGeniusRefreshPlan(current, "Same line");
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});

		expect(plan.unchangedCount).toBe(1);
		expect(result.changedCount).toBe(0);
		expect(result.lyrics.lyricLines[0]).toBe(current.lyricLines[0]);
	});

	it("matches a background line against its parenthetical on Genius", () => {
		const current = lyrics(
			line(
				"line-1",
				"Survival of the fit, only the strong survive",
				1000,
				4000,
			),
			backgroundLine("line-2", "We still livin' it", 3000, 5000),
		);
		const plan = buildGeniusRefreshPlan(
			current,
			"Survival of the fit, only the strong survive (We still livin' it)",
		);

		expect(plan.entries).toHaveLength(1);
		expect(plan.changedCount).toBe(0);
		expect(plan.removedCount).toBe(0);
		expect(plan.unchangedCount).toBe(1);

		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});
		expect(result.lyrics.lyricLines).toHaveLength(2);
		expect(result.lyrics.lyricLines[0]).toBe(current.lyricLines[0]);
		expect(result.lyrics.lyricLines[1]).toBe(current.lyricLines[1]);
	});

	it("does not report background lines as missing when Genius omits them", () => {
		const current = lyrics(
			line("line-1", "Main line", 1000, 2000),
			backgroundLine("line-2", "Background", 1200, 2200),
		);
		const plan = buildGeniusRefreshPlan(current, "Main line");

		expect(plan.removedCount).toBe(0);
		expect(plan.entries).toHaveLength(1);

		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});
		expect(result.lyrics.lyricLines).toEqual(current.lyricLines);
	});

	it("keeps the background line when the main line changes", () => {
		const current = lyrics(
			line("line-1", "Old main", 1000, 3000),
			backgroundLine("line-2", "Old background", 1500, 3500),
		);
		const plan = buildGeniusRefreshPlan(current, "New main (New background)");

		expect(plan.changedCount).toBe(1);
		expect(plan.removedCount).toBe(0);

		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: false,
			segmentationConfig,
		});
		expect(result.lyrics.lyricLines.map(getGeniusRefreshLineText)).toEqual([
			"New main",
			"Old background",
		]);
		expect(result.lyrics.lyricLines[1].isBG).toBe(true);
		expect(result.lyrics.lyricLines[1].startTime).toBe(1500);
	});

	it("treats heavily rewritten lines as new and missing instead of reusing a timestamp", () => {
		const current = lyrics(
			line("line-1", "Quantum physics", 1000, 2000),
			line("line-2", "Purple monkey", 2000, 3000),
		);
		const plan = buildGeniusRefreshPlan(
			current,
			"Completely different\nAnother unrelated line",
		);

		expect(plan.changedCount).toBe(0);
		expect(plan.removedCount).toBe(2);
		expect(plan.addedCount).toBe(2);

		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: true,
			segmentationConfig,
		});
		expect(result.lyrics.lyricLines.map(getGeniusRefreshLineText)).toEqual([
			"Completely different",
			"Another unrelated line",
		]);
		expect(result.lyrics.lyricLines.map((item) => item.startTime)).toEqual([
			0, 0,
		]);

		const preserved = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: false,
			segmentationConfig,
		});
		expect(preserved.lyrics.lyricLines.map(getGeniusRefreshLineText)).toEqual([
			"Quantum physics",
			"Purple monkey",
		]);
	});

	it("normalizes accents and typographic punctuation before comparing", () => {
		const current = lyrics(line("line-1", "Café — l’amour", 1000, 2000));
		const plan = buildGeniusRefreshPlan(current, "Cafe - l'amour");

		expect(plan.unchangedCount).toBe(1);
		expect(plan.changedCount).toBe(0);
	});

	it("preserves line timing when a line-synced line changes", () => {
		const oldLine = {
			...line("line-1", "Old words", 1000, 4000, [
				word("word-1", "Old ", 1000, 2000),
				word("word-2", "words", 2000, 4000),
			]),
			isLineSynced: true,
		};
		const current = lyrics(oldLine);
		const plan = buildGeniusRefreshPlan(current, "New words");

		expect(plan.changedCount).toBe(1);
		const result = applyGeniusRefreshPlan(current, plan, {
			includeStructuralChanges: false,
			segmentationConfig,
		});
		const refreshed = result.lyrics.lyricLines[0];
		expect(refreshed.words).toHaveLength(1);
		expect(refreshed.startTime).toBe(1000);
		expect(refreshed.endTime).toBe(4000);
		expect(refreshed.words[0].startTime).toBe(1000);
		expect(refreshed.words[0].endTime).toBe(4000);
	});

	it("keeps a short line that only gains a word", () => {
		const current = lyrics(line("line-1", "Oh", 1000, 2000));
		const plan = buildGeniusRefreshPlan(current, "Oh yeah");

		expect(plan.changedCount).toBe(1);
		expect(plan.addedCount).toBe(0);
		expect(plan.removedCount).toBe(0);
	});
});
