import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	cloneLyricLine,
	duplicateLinesAfterSelection,
	resolveNewLineInsertionIndex,
} from "./line-creation";

function line(id: string, startTime: number, endTime: number) {
	return { ...newLyricLine(), id, startTime, endTime };
}

describe("line creation anchors", () => {
	const lines = [line("a", 1000, 2000), line("b", 3000, 4000)];

	it("inserts after the last selected line", () => {
		expect(
			resolveNewLineInsertionIndex(lines, {
				selectedLineIds: new Set(["a"]),
				currentTime: 0,
				mode: "afterSelected",
			}),
		).toBe(1);
	});

	it("falls back to the line under the playhead", () => {
		expect(
			resolveNewLineInsertionIndex(lines, {
				selectedLineIds: new Set(),
				currentTime: 3200,
				mode: "afterSelected",
			}),
		).toBe(2);
	});

	it("uses the last started line when the playhead is in a gap", () => {
		expect(
			resolveNewLineInsertionIndex(lines, {
				selectedLineIds: new Set(),
				currentTime: 2500,
				mode: "afterSelected",
			}),
		).toBe(1);
	});

	it("appends when there is no anchor or the mode says end", () => {
		expect(
			resolveNewLineInsertionIndex(lines, {
				selectedLineIds: new Set(),
				currentTime: 0,
				mode: "afterSelected",
			}),
		).toBe(2);
		expect(
			resolveNewLineInsertionIndex(lines, {
				selectedLineIds: new Set(["a"]),
				currentTime: 1500,
				mode: "end",
			}),
		).toBe(2);
	});
});

describe("line duplication", () => {
	it("clears timing by default and keeps original order", () => {
		const source = line("source", 1000, 2500);
		source.words = [
			{
				...newLyricWord(),
				id: "word",
				word: "hello",
				startTime: 1000,
				endTime: 2500,
			},
		];
		const lyrics = {
			metadata: [],
			lyricLines: [source, line("next", 3000, 4000)],
		};

		const ids = duplicateLinesAfterSelection(lyrics, new Set(["source"]), {
			keepTiming: false,
		});

		expect(ids).toHaveLength(1);
		expect(lyrics.lyricLines.map((item) => item.id)).toEqual([
			"source",
			ids[0],
			"next",
		]);
		const copy = lyrics.lyricLines[1];
		expect(copy.words[0].word).toBe("hello");
		expect(copy.startTime).toBe(0);
		expect(copy.endTime).toBe(0);
		expect(copy.words[0].startTime).toBe(0);
		expect(copy.isLineSynced).toBe(false);
		expect(copy.words[0].id).not.toBe("word");
	});

	it("keeps timing for duplicate with timing", () => {
		const copy = cloneLyricLine(line("source", 1000, 2500), {
			keepTiming: true,
		});
		expect(copy.startTime).toBe(1000);
		expect(copy.endTime).toBe(2500);
		expect(copy.id).not.toBe("source");
	});
});