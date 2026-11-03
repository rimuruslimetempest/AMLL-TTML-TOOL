import { describe, expect, it } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import { collectCues, cueListsEqual } from "./cue-sources";

const word = (startTime: number, text: string): LyricWord => ({
	id: `${text}-${startTime}`,
	startTime,
	endTime: startTime + 100,
	word: text,
	obscene: false,
	romanWord: "",
});

const line = (
	id: string,
	startTime: number,
	words: LyricWord[],
	sectionId?: string,
): LyricLine => ({
	id,
	words,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime,
	endTime: startTime + 1000,
	ignoreSync: false,
	isLineSynced: false,
	language: "auto",
	sectionId,
});

const makeLyric = (): TTMLLyric => ({
	metadata: [],
	marks: [{ timeMs: 100, label: "Intro" }, { timeMs: 5000 }],
	sections: [
		{ id: "verse", label: "Verse 1", category: "verse" },
		{ id: "chorus", label: "Chorus", category: "chorus" },
	],
	lyricLines: [
		line("l1", 0, [word(1000, "a"), word(1100, "b")], "verse"),
		line("l2", 0, [word(2000, "c")], "verse"),
		line("l3", 4000, [word(4000, "d")], "chorus"),
	],
});

describe("collectCues", () => {
	it("collects marks as-is", () => {
		const cues = collectCues(makeLyric(), ["marks"]);
		expect(cues.map((cue) => cue.timeMs)).toEqual([100, 5000]);
		expect(cues[0]).toMatchObject({ kind: "marks", label: "Intro" });
	});

	it("puts section cues on the first timed line of each section", () => {
		const cues = collectCues(makeLyric(), ["sections"]);
		expect(cues).toEqual([
			{
				id: "section:1000:verse",
				timeMs: 1000,
				kind: "sections",
				label: "Verse 1",
			},
			{
				id: "section:4000:chorus",
				timeMs: 4000,
				kind: "sections",
				label: "Chorus",
			},
		]);
	});

	it("falls back to the first timed word for line and section starts", () => {
		const cues = collectCues(makeLyric(), ["lines"]);
		expect(cues.map((cue) => cue.timeMs)).toEqual([1000, 2000, 4000]);
	});

	it("collects timed words and merges cues inside the minimum gap", () => {
		const lyric = makeLyric();
		lyric.lyricLines[0].words.push(word(1020, "x"));
		const cues = collectCues(lyric, ["words"], 60);
		expect(cues.map((cue) => cue.timeMs)).toEqual([1000, 1100, 2000, 4000]);
	});

	it("keeps the higher-priority source when cues collide", () => {
		const lyric = makeLyric();
		lyric.marks = [{ timeMs: 1000, label: "Verse" }];
		const cues = collectCues(lyric, ["marks", "sections", "lines", "words"]);
		expect(cues.filter((cue) => cue.timeMs === 1000)).toHaveLength(1);
		expect(cues.find((cue) => cue.timeMs === 1000)?.kind).toBe("marks");
	});

	it("ignores untimed lines and invalid marks", () => {
		const lyric = makeLyric();
		lyric.lyricLines = [line("empty", 0, [])];
		lyric.marks = [{ timeMs: Number.NaN }, { timeMs: -5 }];
		expect(collectCues(lyric, ["marks", "lines", "sections", "words"])).toEqual(
			[],
		);
	});
});

describe("cueListsEqual", () => {
	it("treats separately built lists with the same cues as equal", () => {
		const a = collectCues(makeLyric(), ["marks"]);
		const b = collectCues(makeLyric(), ["marks"]);
		expect(a).not.toBe(b);
		expect(cueListsEqual(a, b)).toBe(true);
	});

	it("ignores label-only changes", () => {
		const a = collectCues(makeLyric(), ["marks"]);
		const lyric = makeLyric();
		lyric.marks = [{ timeMs: 100, label: "Renamed" }, { timeMs: 5000 }];
		expect(cueListsEqual(a, collectCues(lyric, ["marks"]))).toBe(true);
	});

	it("detects moved, added, and removed cues", () => {
		const a = collectCues(makeLyric(), ["lines"]);

		const moved = makeLyric();
		moved.lyricLines[0].startTime = 1500;
		expect(cueListsEqual(a, collectCues(moved, ["lines"]))).toBe(false);
		expect(cueListsEqual(a, collectCues(makeLyric(), ["marks"]))).toBe(false);
		expect(cueListsEqual(a, a.slice(1))).toBe(false);
	});
});

describe("collectCues with no sources", () => {
	it("returns an empty list", () => {
		expect(collectCues(makeLyric(), [])).toEqual([]);
	});
});
