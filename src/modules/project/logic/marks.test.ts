import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import { toggleMarkAt, updateMarkAt } from "./marks";

const lyric = (): TTMLLyric => ({
	metadata: [],
	lyricLines: [],
	marks: [{ timeMs: 1000, label: "Verse" }, { timeMs: 3000 }],
});

describe("toggleMarkAt", () => {
	it("adds a sorted mark at the requested time", () => {
		const next = toggleMarkAt(lyric(), 2000);
		expect(next.marks?.map((mark) => mark.timeMs)).toEqual([1000, 2000, 3000]);
	});

	it("removes a mark within the tolerance instead of adding one", () => {
		const next = toggleMarkAt(lyric(), 1080);
		expect(next.marks?.map((mark) => mark.timeMs)).toEqual([3000]);
	});

	it("keeps marks outside the tolerance", () => {
		const next = toggleMarkAt(lyric(), 1200);
		expect(next.marks?.map((mark) => mark.timeMs)).toEqual([1000, 1200, 3000]);
	});
});

describe("updateMarkAt", () => {
	it("patches only the mark with the exact time", () => {
		const next = updateMarkAt(lyric(), 1000, {
			label: "Intro",
			description: "First section",
		});
		expect(next.marks).toEqual([
			{ timeMs: 1000, label: "Intro", description: "First section" },
			{ timeMs: 3000 },
		]);
	});
});
