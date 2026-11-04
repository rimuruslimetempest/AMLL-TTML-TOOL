import { describe, expect, it } from "vitest";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	getProjectLanguage,
	getTimingMode,
	SUBMISSION_RULES,
} from "./submissionRules";
import type {
	SubmissionCheckContext,
	SubmissionFinding,
	SubmissionRule,
} from "./types";

const word = (text: string, startTime = 1000, endTime = 2000): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const line = (
	text: string,
	options: {
		id?: string;
		startTime?: number;
		endTime?: number;
		isBG?: boolean;
		isDuet?: boolean;
		isLineSynced?: boolean;
		sectionId?: string;
		language?: string;
		words?: LyricWord[];
		romanLyric?: string;
	} = {},
): LyricLine => {
	const result = {
		...newLyricLine(),
		id: options.id ?? `line-${text || "empty"}`,
		startTime: options.startTime ?? 1000,
		endTime: options.endTime ?? 2000,
		isBG: options.isBG ?? false,
		isDuet: options.isDuet ?? false,
		isLineSynced: options.isLineSynced ?? false,
		sectionId: options.sectionId,
		language: options.language,
		romanLyric: options.romanLyric ?? "",
		words: [] as LyricWord[],
	};
	result.words =
		options.words ??
		(text ? [word(text, result.startTime, result.endTime)] : []);
	return result;
};

const lyric = (
	lines: LyricLine[],
	metadata: TTMLLyric["metadata"] = [],
): TTMLLyric => ({ metadata, lyricLines: lines });

const rule = (id: string): SubmissionRule => {
	const result = SUBMISSION_RULES.find((item) => item.id === id);
	if (!result) throw new Error(`Missing submission rule: ${id}`);
	return result;
};

const run = (
	id: string,
	project: TTMLLyric,
	overrides: Partial<SubmissionCheckContext> = {},
): SubmissionFinding[] =>
	rule(id).check({
		lyric: project,
		exportedTTML: "",
		exportError: null,
		lineNumbers: getLineDisplayNumbers(project.lyricLines),
		projectLanguage: getProjectLanguage(project),
		timingMode: getTimingMode(project),
		...overrides,
	});

describe("submission checklist rules", () => {
	it("flags empty lyric lines and offers a mechanical fix only when safe", () => {
		const findings = run("empty-lines", lyric([line("", { words: [] })]));
		expect(findings).toHaveLength(1);
		expect(findings[0]?.fix).toBe("remove-empty-lines");

		const translated = run(
			"empty-lines",
			lyric([line("", { words: [], romanLyric: "not empty" })]),
		);
		expect(translated).toHaveLength(1);
		expect(translated[0]?.fix).toBeUndefined();
	});

	it("flags an untimed line and an invalid word span", () => {
		const project = lyric([
			line("untimed", {
				startTime: 0,
				endTime: 0,
				words: [word("untimed", 1000, 2000)],
			}),
			line("word", {
				words: [word("bad", 1000, 1000), word("later", 1100, 1500)],
			}),
		]);
		const findings = run("untimed-lyrics", project);
		expect(findings).toHaveLength(2);
		expect(findings[0]?.lineIndex).toBe(0);
	});

	it("does not require word timing on a line-synced line", () => {
		const findings = run(
			"untimed-lyrics",
			lyric([
				line("Line synced", {
					isLineSynced: true,
					words: [word("Line"), word("synced")],
				}),
			]),
		);
		expect(findings).toEqual([]);
	});

	it("flags a project that mixes line and word timing", () => {
		const findings = run(
			"single-timing-mode",
			lyric([
				line("Line synced", { isLineSynced: true }),
				line("Word timed", {
					words: [word("Word", 1000, 1500), word("timed", 1500, 2000)],
				}),
			]),
		);
		expect(findings).toHaveLength(1);
	});

	it("flags placeholders, brackets, and manual ellipses", () => {
		expect(run("placeholder-text", lyric([line("Hello [?]")]))).toHaveLength(1);
		expect(run("placeholder-text", lyric([line("[Chorus]")]))).toHaveLength(1);
		expect(run("manual-ellipsis", lyric([line("...")]))).toHaveLength(1);
		expect(run("manual-ellipsis", lyric([line("…")]))).toHaveLength(1);
	});

	it("flags held letters but not valid repeated syllables with hyphens", () => {
		expect(run("held-letters", lyric([line("sooooooo")]))).toHaveLength(1);
		expect(run("held-letters", lyric([line("so-o-o")]))).toEqual([]);
	});

	it("flags repeated phrases joined by a hyphen but not short repeats", () => {
		expect(
			run("hyphenated-repeated-phrase", lyric([line("You get-you get")])),
		).toHaveLength(1);
		expect(run("hyphenated-repeated-phrase", lyric([line("I-I got")]))).toEqual(
			[],
		);
	});

	it("requires exactly four asterisks for a censor beep", () => {
		expect(run("censor-asterisks", lyric([line("***")]))).toHaveLength(1);
		expect(run("censor-asterisks", lyric([line("****")]))).toEqual([]);
	});

	it("flags parentheses in background lyrics", () => {
		expect(
			run("background-parentheses", lyric([line("(hello)", { isBG: true })])),
		).toHaveLength(1);
		expect(
			run("background-parentheses", lyric([line("hello", { isBG: true })])),
		).toEqual([]);
	});

	it("detects Latin text standing in for a non-Latin project language", () => {
		const metadata: TTMLLyric["metadata"] = [
			{ key: "language", value: ["ja"] },
		];
		expect(
			run("romanization-in-place", lyric([line("Hello")], metadata)),
		).toHaveLength(1);
		expect(
			run("romanization-in-place", lyric([line("こんにちは")], metadata)),
		).toEqual([]);
		expect(run("romanization-in-place", lyric([line("Hello")]))).toEqual([]);
	});

	it("groups whitespace and lowercase line starts into one review item", () => {
		const findings = run(
			"text-whitespace-capitalization",
			lyric([line(" hello  world"), line("another line"), line("Third line")]),
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.lineIndex).toBe(0);
		expect(findings[0]?.lineIndices).toEqual([0, 1]);
		expect(findings[0]?.detail).toContain("2 lines have");
		expect(findings[0]?.detail).toContain("a lowercase first letter");
	});

	it("flags a deliberate-looking tiny gap but not a real pause", () => {
		const project = lyric([
			line("two words", {
				words: [word("one", 1000, 1400), word("two", 1500, 1900)],
			}),
		]);
		expect(run("possible-arbitrary-gap", project)).toHaveLength(1);

		const paused = lyric([
			line("two words", {
				words: [word("one", 1000, 1400), word("two", 1700, 2100)],
			}),
		]);
		expect(run("possible-arbitrary-gap", paused)).toEqual([]);
	});

	it("flags same-line overlaps and extreme syllable durations", () => {
		expect(
			run(
				"word-overlap",
				lyric([
					line("overlap", {
						words: [word("one", 1000, 1600), word("two", 1500, 1900)],
					}),
				]),
			),
		).toHaveLength(1);

		expect(
			run(
				"syllable-duration",
				lyric([
					line("duration", {
						words: [word("a", 1000, 1030), word("b", 1100, 9200)],
					}),
				]),
			),
		).toHaveLength(2);
	});

	it("flags line order and a suspicious first-line offset", () => {
		expect(
			run(
				"line-order",
				lyric([
					line("later", { startTime: 3000, endTime: 4000 }),
					line("earlier", { startTime: 2000, endTime: 2500 }),
				]),
			),
		).toHaveLength(1);
		expect(
			run("first-line-offset", lyric([line("early", { startTime: 300 })])),
		).toHaveLength(1);
		expect(
			run("first-line-offset", lyric([line("normal", { startTime: 2000 })])),
		).toEqual([]);
	});

	it("flags a lone background line after a lead line", () => {
		expect(
			run(
				"single-background-line",
				lyric([line("lead"), line("bg", { isBG: true })]),
			),
		).toHaveLength(1);
		expect(
			run(
				"single-background-line",
				lyric([line("bg", { isBG: true }), line("lead")]),
			),
		).toEqual([]);
	});

	it("flags a background line that begins a new section", () => {
		expect(
			run(
				"background-at-section-start",
				lyric([
					line("lead", { sectionId: "verse" }),
					line("bg", { isBG: true, sectionId: "chorus" }),
				]),
			),
		).toHaveLength(1);
		expect(
			run(
				"background-at-section-start",
				lyric([
					line("lead", { sectionId: "verse" }),
					line("bg", { isBG: true, sectionId: "verse" }),
				]),
			),
		).toEqual([]);
	});

	it("flags a background line on the opposite duet side", () => {
		expect(
			run(
				"duet-side",
				lyric([
					line("lead", { isDuet: true }),
					line("bg", { isBG: true, isDuet: false }),
				]),
			),
		).toHaveLength(1);
		expect(
			run(
				"duet-side",
				lyric([
					line("lead", { isDuet: true }),
					line("bg", { isBG: true, isDuet: true }),
				]),
			),
		).toEqual([]);
	});

	it("warns about missing supported-language romanization and reviews existing romanization", () => {
		const metadata: TTMLLyric["metadata"] = [
			{ key: "language", value: ["ja"] },
		];
		expect(
			run("romanization-supported", lyric([line("こんにちは")], metadata)),
		).toHaveLength(1);
		expect(
			run(
				"romanization-review",
				lyric([line("こんにちは", { romanLyric: "konnichiwa" })]),
			),
		).toHaveLength(1);
	});

	it("flags possible oversplitting but allows ordinary syllables", () => {
		expect(
			run(
				"possible-oversplitting",
				lyric([
					line("thi nk", {
						words: [word("thi", 1000, 1400), word("nk", 1400, 1800)],
					}),
				]),
			),
		).toHaveLength(1);
		expect(
			run(
				"possible-oversplitting",
				lyric([
					line("beau ti ful", {
						words: [
							word("beau", 1000, 1400),
							word("ti", 1400, 1800),
							word("ful", 1800, 2200),
						],
					}),
				]),
			),
		).toEqual([]);
	});

	it("flags a visible split-only hyphen beside another timed part", () => {
		expect(
			run(
				"split-spelling",
				lyric([
					line("love- ly", {
						words: [word("love-", 1000, 1400), word("ly", 1400, 1800)],
					}),
				]),
			),
		).toHaveLength(1);
	});

	it("reports a failed export validation without running DOM checks", () => {
		expect(
			run("export-roundtrip", lyric([line("Hello")]), {
				exportError: "writer failed",
			}),
		).toHaveLength(1);
	});

	it("requires songwriter metadata", () => {
		expect(run("songwriter-metadata", lyric([line("Hello")]))).toHaveLength(1);
		expect(
			run(
				"songwriter-metadata",
				lyric([line("Hello")], [{ key: "songwriter", value: ["Writer"] }]),
			),
		).toEqual([]);
	});
});
