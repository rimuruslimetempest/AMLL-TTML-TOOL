import { describe, expect, it } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import { runLocalChecks } from "./local-checks";

const word = (overrides: Partial<LyricWord> = {}): LyricWord => ({
	id: Math.random().toString(36),
	startTime: 0,
	endTime: 0,
	word: "la",
	obscene: false,
	romanWord: "",
	...overrides,
});

const line = (words: LyricWord[], overrides: Partial<LyricLine> = {}): LyricLine => ({
	id: Math.random().toString(36),
	words,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: 0,
	endTime: 0,
	ignoreSync: false,
	isLineSynced: false,
	language: "auto",
	...overrides,
});

const lyric = (lines: LyricLine[]): TTMLLyric => ({ metadata: [], lyricLines: lines });

const TTML_OK =
	'<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><body></body></tt>';

const messages = (issues: ReturnType<typeof runLocalChecks>) =>
	issues.map((issue) => issue.message).join(" | ");

describe("runLocalChecks", () => {
	it("flags inverted syllables", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ startTime: 1000, endTime: 900 })], {
					startTime: 0,
					endTime: 2000,
				}),
			]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("ends at 900 ms but starts at 1000 ms");
		expect(issues.some((issue) => issue.severity === "error")).toBe(true);
	});

	it("flags overlapping syllables and long gaps", () => {
		const issues = runLocalChecks(
			lyric([
				line(
					[
						word({ startTime: 100, endTime: 1000 }),
						word({ startTime: 900, endTime: 1500 }),
						word({ startTime: 4000, endTime: 4500 }),
					],
					{ startTime: 0, endTime: 5000 },
				),
			]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("before the previous one ends");
		expect(messages(issues)).toContain("possible missing sync");
	});

	it("flags lines that start before the previous line", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ startTime: 5000, endTime: 6000 })], {
					startTime: 5000,
					endTime: 6000,
				}),
				line([word({ startTime: 1000, endTime: 2000 })], {
					startTime: 1000,
					endTime: 2000,
				}),
			]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("starts earlier");
	});

	it("does not flag a background line starting before the previous line", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ startTime: 5000, endTime: 6000 })], {
					startTime: 5000,
					endTime: 6000,
				}),
				line([word({ startTime: 4000, endTime: 4500 })], {
					startTime: 4000,
					endTime: 4500,
					isBG: true,
				}),
				line([word({ startTime: 7000, endTime: 8000 })], {
					startTime: 7000,
					endTime: 8000,
				}),
			]),
			TTML_OK,
		);
		expect(messages(issues)).not.toContain("starts earlier");
	});

	it("numbers lines like the editor, with background lines sharing the parent number", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ word: "a", startTime: 100, endTime: 900 })], {
					startTime: 100,
					endTime: 900,
				}),
				line([word({ word: "b", startTime: 200, endTime: 800 })], {
					startTime: 200,
					endTime: 800,
					isBG: true,
				}),
				line([word({ word: "c" })]),
			]),
			TTML_OK,
		);
		const untimed = issues.find((issue) =>
			issue.message.includes("no timing at all"),
		);
		expect(untimed).toMatchObject({ line: 2, lineIndex: 2 });
	});

	it("flags empty text and offers a whitespace fix", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ word: "", startTime: 0, endTime: 100 }), word({ word: "  be  " })]),
			]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("text is empty");
		const whitespace = issues.find((issue) => issue.fix?.kind === "syllableText");
		expect(whitespace?.fix).toEqual({ kind: "syllableText", text: "be" });
	});

	it("flags a line with no timing at all", () => {
		const issues = runLocalChecks(
			lyric([line([word({ word: "hello" })])]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("no timing at all");
	});

	it("flags syllables outside the line range and extreme durations", () => {
		const issues = runLocalChecks(
			lyric([
				line(
					[
						word({ startTime: 300, endTime: 330 }),
						word({ startTime: 900, endTime: 12000 }),
					],
					{ startTime: 500, endTime: 10000 },
				),
			]),
			TTML_OK,
		);
		expect(messages(issues)).toContain("starts before the line begins");
		expect(messages(issues)).toContain("ends after the line ends");
		expect(messages(issues)).toContain("only 30 ms long");
		expect(messages(issues)).toContain("11100 ms long");
	});

	it("flags missing TTML attributes and duet lines without an agent", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ word: "hi", startTime: 100, endTime: 500 })], {
					startTime: 100,
					endTime: 500,
					isDuet: true,
				}),
			]),
			"<tt><body></body></tt>",
		);
		expect(messages(issues)).toContain("xmlns");
		expect(messages(issues)).toContain("itunes:timing");
		expect(messages(issues)).toContain("Duet line has no agent tag");
	});

	it("returns no issues for a clean project", () => {
		const issues = runLocalChecks(
			lyric([
				line([word({ word: "la", startTime: 100, endTime: 700 })], {
					startTime: 100,
					endTime: 700,
				}),
			]),
			TTML_OK,
		);
		expect(issues).toEqual([]);
	});
});