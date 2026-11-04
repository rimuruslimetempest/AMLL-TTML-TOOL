import { parseLyric } from "$/modules/project/logic/ttml-parser";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import { isVoiceRightAligned } from "$/types/ttml";
import type {
	SubmissionFinding,
	SubmissionManualSection,
	SubmissionRoute,
	SubmissionRule,
	SubmissionTimingMode,
} from "./types";

const TTML_NS = "http://www.w3.org/ns/ttml";
const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";

const LATIN_CHAR = /[A-Za-z\u00c0-\u024f\u1e00-\u1eff]/;
const LATIN_LANGUAGE_CODES = new Set([
	"af",
	"ca",
	"cs",
	"cy",
	"da",
	"de",
	"en",
	"es",
	"et",
	"fi",
	"fil",
	"fr",
	"ga",
	"gl",
	"hr",
	"hu",
	"id",
	"is",
	"it",
	"lt",
	"lv",
	"ms",
	"nb",
	"nl",
	"no",
	"pl",
	"pt",
	"ro",
	"sk",
	"sl",
	"sv",
	"sw",
	"tl",
	"tr",
	"vi",
]);

const NON_LATIN_LANGUAGE_CODES = new Set([
	"ab",
	"ady",
	"am",
	"ar",
	"av",
	"ba",
	"be",
	"bg",
	"bn",
	"bo",
	"ce",
	"cv",
	"dz",
	"el",
	"fa",
	"gu",
	"he",
	"hi",
	"hy",
	"ja",
	"ka",
	"kk",
	"km",
	"kn",
	"ko",
	"ky",
	"lo",
	"mk",
	"ml",
	"mn",
	"my",
	"pa",
	"ru",
	"sa",
	"si",
	"sr",
	"ta",
	"te",
	"tg",
	"th",
	"ti",
	"tt",
	"udm",
	"uk",
	"ur",
	"zh",
]);

const ROMANIZATION_LANGUAGE_CODES = new Set([
	"ar",
	"be",
	"bg",
	"bn",
	"el",
	"fa",
	"gu",
	"he",
	"hi",
	"hy",
	"ja",
	"ka",
	"kk",
	"km",
	"kn",
	"ko",
	"ky",
	"lo",
	"mk",
	"ml",
	"mn",
	"my",
	"pa",
	"ru",
	"sr",
	"ta",
	"te",
	"th",
	"uk",
	"ur",
	"zh",
]);

const LANGUAGE_NAMES: Record<string, string> = {
	arabic: "ar",
	chinese: "zh",
	greek: "el",
	hebrew: "he",
	hindi: "hi",
	japanese: "ja",
	korean: "ko",
	russian: "ru",
	serbian: "sr",
	thai: "th",
	ukrainian: "uk",
};

const normalizeLanguage = (value: string): string => {
	const trimmed = value.trim().toLowerCase().replace(/_/g, "-");
	const name = LANGUAGE_NAMES[trimmed];
	if (name) return name;
	return trimmed.split("-")[0] ?? "";
};

export function hasLyricText(line: LyricLine): boolean {
	return line.words.some((word) => word.word.trim().length > 0);
}

/**
 * A line is safe to remove mechanically only when it has no lyric, ruby,
 * romanization, or translation content. Anything else needs a human decision.
 */
export function isRemovableEmptyLine(line: LyricLine): boolean {
	return (
		!hasLyricText(line) &&
		!line.romanLyric.trim() &&
		!line.translatedLyric.trim() &&
		!line.words.some(
			(word) =>
				word.romanWord.trim().length > 0 ||
				(word.ruby?.some((rubyWord) => rubyWord.word.trim().length > 0) ??
					false),
		)
	);
}

export function getLineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("");
}

function textWords(line: LyricLine): Array<{ word: LyricWord; index: number }> {
	return line.words
		.map((word, index) => ({ word, index }))
		.filter(({ word }) => word.word.trim().length > 0);
}

function isValidTiming(startTime: number, endTime: number): boolean {
	return (
		Number.isFinite(startTime) &&
		Number.isFinite(endTime) &&
		startTime >= 0 &&
		endTime > startTime
	);
}

function lineNeedsWordTiming(line: LyricLine): boolean {
	// A line-synced line is timed by its paragraph attributes. Every other
	// line is exported through its word spans, so every word must be valid.
	if (line.isLineSynced) return false;
	return textWords(line).length > 0;
}

function formatMs(value: number): string {
	return `${Math.round(value)} ms`;
}

function formatReasons(reasons: string[]): string {
	if (reasons.length <= 1) return reasons[0] ?? "";
	const last = reasons[reasons.length - 1] ?? "";
	return `${reasons.slice(0, -1).join(", ")} and ${last}`;
}

function finding(
	lineIndex: number,
	detail: string,
	extra: Omit<SubmissionFinding, "lineIndex" | "detail"> = {},
): SubmissionFinding {
	return { lineIndex, detail, ...extra };
}

function normalizePhrase(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

function hasLatinLetter(value: string): boolean {
	return LATIN_CHAR.test(value);
}

function hasNonLatinLetter(value: string): boolean {
	const letters = value.match(/\p{L}/gu);
	return Boolean(letters?.some((letter) => !LATIN_CHAR.test(letter)));
}

function hasVowel(value: string): boolean {
	return /[aeiouy]/i.test(value);
}

function vowelGroups(value: string): number {
	return value.match(/[aeiouy]+/gi)?.length ?? 0;
}

function hasRomanization(lyric: TTMLLyric): boolean {
	return lyric.lyricLines.some(
		(line) =>
			line.romanLyric.trim().length > 0 ||
			line.words.some((word) => word.romanWord.trim().length > 0),
	);
}

/**
 * The app stores language on each line (and sometimes in metadata), not as a
 * dedicated project field. Only return an explicit value; never infer one.
 */
export function getProjectLanguage(lyric: TTMLLyric): string | null {
	for (const key of ["language", "lyriclanguage", "lang"]) {
		const metadata = lyric.metadata.find(
			(item) => item.key.toLowerCase() === key,
		);
		const value = metadata?.value.find((item) => item.trim().length > 0);
		if (value) return normalizeLanguage(value);
	}

	for (const line of lyric.lyricLines) {
		const value = line.language?.trim();
		if (
			!value ||
			value.toLowerCase() === "auto" ||
			value.toLowerCase() === "off"
		)
			continue;
		return normalizeLanguage(value);
	}

	return null;
}

export function getTimingMode(lyric: TTMLLyric): SubmissionTimingMode {
	const lines = lyric.lyricLines.filter(hasLyricText);
	if (lines.length === 0) return "none";

	const hasLineSynced = lines.some((line) => Boolean(line.isLineSynced));
	const hasWordTimed = lines.some(
		(line) => !line.isLineSynced && textWords(line).length > 1,
	);

	if (hasLineSynced && hasWordTimed) return "mixed";
	if (hasLineSynced) return "line";
	if (hasWordTimed) return "word";
	return "line";
}

const isLatinLanguage = (language: string | null): boolean =>
	language === null || LATIN_LANGUAGE_CODES.has(language);

const isNonLatinLanguage = (language: string | null): boolean =>
	language !== null && NON_LATIN_LANGUAGE_CODES.has(language);

export const SUBMISSION_RULES: SubmissionRule[] = [
	{
		id: "empty-lines",
		level: "required",
		category: "compatibility",
		message: "No empty lyric lines",
		fixHint:
			"Remove the empty line. Empty lyric lines can prevent Spicy Lyrics from loading the file.",
		check: ({ lyric }) =>
			lyric.lyricLines.flatMap((line, lineIndex) =>
				hasLyricText(line)
					? []
					: [
							finding(lineIndex, "This lyric line contains no sung text.", {
								fix: isRemovableEmptyLine(line)
									? "remove-empty-lines"
									: undefined,
							}),
						],
			),
	},
	{
		id: "untimed-lyrics",
		level: "required",
		category: "timing",
		message: "Every lyric is timed",
		fixHint:
			"Give every line a valid start and end, and give every word a valid span when the line uses word-by-word timing.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				if (!hasLyricText(line)) return;

				if (!isValidTiming(line.startTime, line.endTime)) {
					issues.push(
						finding(
							lineIndex,
							`Line timing is invalid (${formatMs(line.startTime)} to ${formatMs(
								line.endTime,
							)}).`,
						),
					);
				}

				if (!lineNeedsWordTiming(line)) return;
				for (const { word, index } of textWords(line)) {
					if (isValidTiming(word.startTime, word.endTime)) continue;
					issues.push(
						finding(
							lineIndex,
							`Word "${word.word.trim()}" has invalid timing (${formatMs(
								word.startTime,
							)} to ${formatMs(word.endTime)}).`,
							{ wordIndex: index },
						),
					);
				}
			});
			return issues;
		},
	},
	{
		id: "single-timing-mode",
		level: "required",
		category: "timing",
		message: "Use one timing mode throughout",
		fixHint:
			"Convert the project to either line-synced timing or word-by-word timing. A line-synced file is valid on its own.",
		check: (context) => {
			if (getTimingMode(context.lyric) !== "mixed") return [];
			const lineIndex = context.lyric.lyricLines.findIndex(
				(line) => hasLyricText(line) && !line.isLineSynced,
			);
			return [
				finding(
					lineIndex >= 0 ? lineIndex : 0,
					"This project mixes line-synced lines and word-by-word lines. Spicy Lyrics does not support mixing them in one file.",
				),
			];
		},
	},
	{
		id: "songwriter-metadata",
		level: "required",
		category: "metadata",
		message: "Songwriter metadata is filled in",
		fixHint:
			"Open Metadata and add the songwriters. Review the names against the recording and release credits.",
		check: ({ lyric }) => {
			const hasSongwriter = lyric.metadata.some(
				(item) =>
					item.key.toLowerCase() === "songwriter" &&
					item.value.some((value) => value.trim().length > 0),
			);
			return hasSongwriter
				? []
				: [
						{
							target: "metadata" as const,
							detail:
								"No songwriter metadata was found. This is required for a submission, so add it before exporting.",
						},
					];
		},
	},
	{
		id: "export-roundtrip",
		level: "required",
		category: "compatibility",
		message: "Exported TTML parses and reloads",
		fixHint:
			"Fix the reported XML/structure problem, then re-check. The exported file must parse and load again without losing lines.",
		check: (context) => {
			if (context.exportError) {
				return [
					finding(
						0,
						`The current project could not be exported for validation: ${context.exportError}`,
					),
				];
			}
			if (!context.exportedTTML.trim()) {
				return [finding(0, "The exported TTML is empty.")];
			}
			if (typeof DOMParser === "undefined") return [];

			try {
				const document = new DOMParser().parseFromString(
					context.exportedTTML,
					"application/xml",
				);
				if (document.getElementsByTagName("parsererror").length > 0) {
					return [finding(0, "The exported TTML is not well-formed XML.")];
				}

				const root = document.documentElement;
				if (root.localName !== "tt" || root.namespaceURI !== TTML_NS) {
					return [
						finding(
							0,
							"The exported document is missing a valid TTML <tt> root element.",
						),
					];
				}
				if (
					!document.querySelector("head") ||
					!document.querySelector("body")
				) {
					return [
						finding(
							0,
							"The exported document is missing the TTML head or body structure.",
						),
					];
				}

				const sourceLines = context.lyric.lyricLines.filter(hasLyricText);
				if (sourceLines.length === 0) return [];

				const timing =
					root.getAttribute("itunes:timing") ??
					root.getAttributeNS(ITUNES_NS, "timing");
				if (timing !== "Word" && timing !== "Line") {
					return [
						finding(
							0,
							'The exported TTML must declare a supported itunes:timing mode ("Word" or "Line").',
						),
					];
				}

				const paragraphs = document.querySelectorAll("body p[begin][end]");
				if (paragraphs.length === 0) {
					return [
						finding(0, "The exported TTML contains no timed lyric paragraphs."),
					];
				}

				const parsed = parseLyric(context.exportedTTML);
				const parsedLines = parsed.lyricLines.filter(hasLyricText);
				if (parsedLines.length !== sourceLines.length) {
					return [
						finding(
							0,
							`The exported file reloads with ${parsedLines.length} lyric lines, but the project has ${sourceLines.length}.`,
						),
					];
				}

				const reserialized = exportTTMLText(parsed, undefined, {
					allowConsecutiveBackgroundLines: true,
				});
				const reparsed = parseLyric(reserialized);
				if (reparsed.lyricLines.length !== parsed.lyricLines.length) {
					return [
						finding(
							0,
							"The exported file changes line count when it is serialized and loaded a second time.",
						),
					];
				}
				return [];
			} catch (error) {
				return [
					finding(
						0,
						`The exported TTML could not be parsed and reloaded: ${
							error instanceof Error ? error.message : String(error)
						}`,
					),
				];
			}
		},
	},
	{
		id: "placeholder-text",
		level: "forbidden",
		category: "text",
		message: "No placeholders, section headings, or stage directions",
		fixHint:
			"Remove bracketed text and guessed filler. Only text that is actually heard in the recording belongs in the lyric layer.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const matches = getLineText(line).match(/\[[^\]]*\]|【[^】]*】/g);
				if (!matches) return;
				issues.push(
					finding(
						lineIndex,
						`Remove ${matches.join(", ")}. Section labels, stage directions, and placeholders are not sung lyrics.`,
					),
				);
			});
			return issues;
		},
	},
	{
		id: "manual-ellipsis",
		level: "forbidden",
		category: "text",
		message: "No manually written instrumental ellipses",
		fixHint:
			"Remove a line that is only dots. Spicy Lyrics creates the interlude display automatically.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const compact = getLineText(line).replace(/\s+/g, "").trim();
				if (!compact) return;
				if (!/^(?:\.{3,}|…+)$/.test(compact)) return;
				issues.push(
					finding(
						lineIndex,
						"This line is only an ellipsis. Do not write interlude dots into the lyrics; the player adds them automatically.",
					),
				);
			});
			return issues;
		},
	},
	{
		id: "held-letters",
		level: "forbidden",
		category: "text",
		message: "No held words written with repeated letters",
		fixHint:
			"Write the normal spelling and express the hold with timing. If this is a real word rather than a stretched syllable, dismiss this reminder.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				line.words.forEach((word, wordIndex) => {
					const match = word.word.match(/([A-Za-z])\1{2,}/i);
					if (!match) return;
					issues.push(
						finding(
							lineIndex,
							`"${word.word.trim()}" contains the repeated run "${match[0]}". This usually represents a held syllable; use timing instead of extra letters.`,
							{ wordIndex },
						),
					);
				});
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "hyphenated-repeated-phrase",
		level: "forbidden",
		category: "text",
		message: "No repeated multiword phrases joined with a hyphen",
		fixHint:
			'Use a comma for a pause ("You get, you get") or an em dash for an abrupt interruption ("You get— you get"). Hyphens are only for repeated syllables or rapid repetition.',
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const text = getLineText(line);
				for (const match of text.matchAll(
					/\b([A-Za-z']+(?:\s+[A-Za-z']+)+)\s*-\s*([A-Za-z']+(?:\s+[A-Za-z']+)+)\b/g,
				)) {
					if (normalizePhrase(match[1]) !== normalizePhrase(match[2])) {
						continue;
					}
					issues.push(
						finding(
							lineIndex,
							`"${match[0]}" joins a repeated multiword phrase with a hyphen. Separate the phrases with a comma for a pause or an em dash for an interruption.`,
						),
					);
				}
			});
			return issues;
		},
	},
	{
		id: "censor-asterisks",
		level: "required",
		category: "text",
		message: "Beep-censored words use exactly four asterisks",
		fixHint:
			'Use exactly "****" when a word is replaced by a censor beep. Use an em dash when the word is cut or muted.',
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				line.words.forEach((word, wordIndex) => {
					const runs = word.word.match(/\*+/g);
					if (!runs) return;
					for (const run of runs) {
						if (run.length === 4) continue;
						issues.push(
							finding(
								lineIndex,
								`Found ${run.length} asterisk${run.length === 1 ? "" : "s"}. A censor beep is written as exactly "****".`,
								{ wordIndex },
							),
						);
					}
				});
			});
			return issues;
		},
	},
	{
		id: "background-parentheses",
		level: "required",
		category: "vocal-roles",
		message: "Background lyrics do not contain parentheses",
		fixHint:
			"Remove parentheses from background lines. Spicy Lyrics already renders the line as a background vocal.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				if (!line.isBG) return;
				const text = getLineText(line);
				if (!/[()（）]/.test(text)) return;
				issues.push(
					finding(
						lineIndex,
						"This background line contains parentheses. The background role already provides the visual treatment.",
					),
				);
			});
			return issues;
		},
	},
	{
		id: "romanization-in-place",
		level: "forbidden",
		category: "romanization",
		message: "Romanization is not used in place of the original lyrics",
		fixHint:
			"Restore the native writing system in the main lyric layer. Romanization belongs in the Romanization field, not in place of the original text.",
		check: (context) => {
			if (!isNonLatinLanguage(context.projectLanguage)) return [];
			const lines = context.lyric.lyricLines.filter(hasLyricText);
			if (lines.length === 0) return [];

			const hasLatin = lines.some((line) => hasLatinLetter(getLineText(line)));
			const hasNonLatin = lines.some((line) =>
				hasNonLatinLetter(getLineText(line)),
			);
			if (!hasLatin || hasNonLatin) return [];

			return [
				finding(
					0,
					`The project language is set to ${context.projectLanguage}, but every lyric line is Latin-script text. Restore the original script instead of using Romanization as the main lyric layer.`,
				),
			];
		},
	},
	{
		id: "text-whitespace-capitalization",
		level: "recommended",
		category: "text",
		message: "Clean line whitespace and capitalization",
		fixHint:
			"Remove leading/trailing or repeated spaces and capitalize the start of conventional sentences. Keep intentional styling when it reflects the recording.",
		check: (context) => {
			const affected: Array<{ lineIndex: number; reasons: string[] }> = [];
			context.lyric.lyricLines.forEach((line, lineIndex) => {
				const text = getLineText(line);
				if (!text.trim()) return;
				const reasons: string[] = [];
				if (/^\s/.test(text)) reasons.push("leading whitespace");
				if (/\s$/.test(text)) reasons.push("trailing whitespace");
				if (/\s{2,}/.test(text)) reasons.push("repeated spaces");
				if (line.words.some((word) => /^\s|\s$|\s{2,}/.test(word.word))) {
					reasons.push("whitespace inside a word span");
				}
				if (
					isLatinLanguage(context.projectLanguage) &&
					/^[a-z]/.test(text.trimStart())
				) {
					reasons.push("a lowercase first letter");
				}
				if (reasons.length === 0) return;
				affected.push({ lineIndex, reasons });
			});
			const first = affected[0];
			if (!first) return [];
			const reasons = Array.from(
				new Set(affected.flatMap((item) => item.reasons)),
			);
			const detail =
				affected.length === 1
					? `This line has ${formatReasons(reasons)}. Clean it up unless the styling is intentional.`
					: `${affected.length} lines have ${formatReasons(reasons)}. Clean them up unless the styling is intentional.`;
			return [
				finding(first.lineIndex, detail, {
					lineIndices: affected.map((item) => item.lineIndex),
				}),
			];
		},
		dismissible: true,
	},
	{
		id: "repeated-section-timing",
		level: "required",
		category: "timing",
		message: "Repeated sections are timed independently",
		fixHint:
			"Time every occurrence. Identical timestamps on a repeated line usually mean the timing was copied instead of synced.",
		check: (context) => {
			const issues: SubmissionFinding[] = [];
			const previousByText = new Map<
				string,
				{ lineIndex: number; startTime: number; endTime: number }
			>();
			context.lyric.lyricLines.forEach((line, lineIndex) => {
				if (!hasLyricText(line)) return;
				const key = normalizePhrase(getLineText(line));
				if (!key) return;

				const previous = previousByText.get(key);
				if (
					previous &&
					previous.lineIndex !== lineIndex &&
					isValidTiming(previous.startTime, previous.endTime) &&
					isValidTiming(line.startTime, line.endTime) &&
					Math.abs(previous.startTime - line.startTime) < 1 &&
					Math.abs(previous.endTime - line.endTime) < 1
				) {
					issues.push(
						finding(
							lineIndex,
							`This repeated line has exactly the same timestamps as line ${
								context.lineNumbers[previous.lineIndex] ??
								previous.lineIndex + 1
							}. Time this occurrence separately.`,
						),
					);
				}
				if (isValidTiming(line.startTime, line.endTime)) {
					previousByText.set(key, {
						lineIndex,
						startTime: line.startTime,
						endTime: line.endTime,
					});
				}
			});
			return issues;
		},
	},
	{
		id: "possible-arbitrary-gap",
		level: "recommended",
		category: "timing",
		message: "Possible arbitrary gap between words",
		fixHint:
			"If the pause is audible, keep it. Otherwise snap the previous end and next start to the same timestamp.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const words = textWords(line);
				for (let index = 1; index < words.length; index++) {
					const previous = words[index - 1];
					const current = words[index];
					if (
						!isValidTiming(previous.word.startTime, previous.word.endTime) ||
						!isValidTiming(current.word.startTime, current.word.endTime)
					) {
						continue;
					}
					const gap = current.word.startTime - previous.word.endTime;
					if (gap <= 0 || gap >= 200) continue;
					issues.push(
						finding(
							lineIndex,
							`There is a ${formatMs(gap)} gap before "${current.word.word.trim()}". This can be an arbitrary boundary rather than an audible pause.`,
							{ wordIndex: current.index },
						),
					);
				}
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "word-overlap",
		level: "recommended",
		category: "timing",
		message: "Review overlapping words",
		fixHint:
			"Genuine overlaps are allowed. Check whether this overlap is audible or whether the previous word should end at the next word's start.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const words = textWords(line);
				for (let index = 1; index < words.length; index++) {
					const previous = words[index - 1];
					const current = words[index];
					if (
						!isValidTiming(previous.word.startTime, previous.word.endTime) ||
						!isValidTiming(current.word.startTime, current.word.endTime)
					) {
						continue;
					}
					if (current.word.startTime >= previous.word.endTime - 1) continue;
					issues.push(
						finding(
							lineIndex,
							`"${current.word.word.trim()}" starts ${formatMs(
								previous.word.endTime - current.word.startTime,
							)} before "${previous.word.word.trim()}" ends. Review the overlap.`,
							{ wordIndex: current.index },
						),
					);
				}
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "syllable-duration",
		level: "recommended",
		category: "timing",
		message: "Review very short or very long syllables",
		fixHint:
			"Check the audio around this syllable. Short and long syllable spans are warnings, not automatic failures.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				for (const { word, index } of textWords(line)) {
					if (!isValidTiming(word.startTime, word.endTime)) continue;
					const duration = word.endTime - word.startTime;
					if (duration < 40) {
						issues.push(
							finding(
								lineIndex,
								`"${word.word.trim()}" is only ${formatMs(
									duration,
								)} long. Check for a very short syllable or a timing error.`,
								{ wordIndex: index },
							),
						);
					} else if (duration > 8000) {
						issues.push(
							finding(
								lineIndex,
								`"${word.word.trim()}" is ${formatMs(
									duration,
								)} long. Check that it spans a held note rather than a missing boundary.`,
								{ wordIndex: index },
							),
						);
					}
				}
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "line-order",
		level: "recommended",
		category: "timing",
		message: "Review a line that starts before the previous line",
		fixHint:
			"Check the line order and timing. This can be intentional for overlaps, but it often indicates a misplaced line.",
		check: (context) => {
			const { lyric } = context;
			const issues: SubmissionFinding[] = [];
			let previousStart: number | null = null;
			let previousIndex = -1;
			lyric.lyricLines.forEach((line, lineIndex) => {
				if (line.isBG || !hasLyricText(line)) return;
				if (!isValidTiming(line.startTime, line.endTime)) return;
				if (previousStart !== null && line.startTime < previousStart - 1) {
					issues.push(
						finding(
							lineIndex,
							`This line starts at ${formatMs(line.startTime)}, earlier than line ${
								context.lineNumbers[previousIndex] ?? previousIndex + 1
							} at ${formatMs(previousStart)}.`,
						),
					);
				}
				previousStart = line.startTime;
				previousIndex = lineIndex;
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "first-line-offset",
		level: "recommended",
		category: "timing",
		message: "Check the overall offset from the first lyric",
		fixHint:
			"If the whole song is consistently early or late, use Time Shift. If the error changes through the song, retime the affected lines instead.",
		check: (context) => {
			const first = context.lyric.lyricLines.find(
				(line) =>
					!line.isBG &&
					hasLyricText(line) &&
					isValidTiming(line.startTime, line.endTime),
			);
			if (!first) return [];
			if (first.startTime >= 1000 && first.startTime <= 90000) return [];
			const lineIndex = context.lyric.lyricLines.indexOf(first);
			return [
				finding(
					lineIndex,
					`The first lyric begins at ${formatMs(
						first.startTime,
					)}. Check the intro and confirm the whole song's offset before submitting.`,
				),
			];
		},
		dismissible: true,
	},
	{
		id: "possible-oversplitting",
		level: "recommended",
		category: "splitting",
		message: "Possible oversplitting",
		fixHint:
			"Splitting is optional. Follow how the singer pronounces the word in the recording; merge parts that belong to one syllable.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const words = textWords(line);
				for (let index = 1; index < words.length; index++) {
					const previous = words[index - 1];
					const current = words[index];
					const previousText = previous.word.word.trim();
					const currentText = current.word.word.trim();
					if (
						!/^[A-Za-z]+$/.test(previousText) ||
						!/^[A-Za-z]+$/.test(currentText) ||
						previousText.length < 2 ||
						currentText.length < 2
					) {
						continue;
					}
					if (
						!isValidTiming(previous.word.startTime, previous.word.endTime) ||
						!isValidTiming(current.word.startTime, current.word.endTime) ||
						Math.abs(previous.word.endTime - current.word.startTime) > 50
					) {
						continue;
					}
					const combined = `${previousText}${currentText}`;
					if (combined.length < 3 || vowelGroups(combined) > 1) continue;
					if (hasVowel(previousText) === hasVowel(currentText)) continue;
					issues.push(
						finding(
							lineIndex,
							`"${previousText}" + "${currentText}" may split one syllable into "${combined}". Splitting should follow the singer's pronunciation.`,
							{ wordIndex: current.index },
						),
					);
				}
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "split-spelling",
		level: "discouraged",
		category: "splitting",
		message: "Avoid split-only hyphens or respelling",
		fixHint:
			"Adjacent syllable spans should render as the normal joined word. Keep a visible hyphen only when the transcription itself requires it.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			lyric.lyricLines.forEach((line, lineIndex) => {
				const words = textWords(line);
				for (let index = 0; index < words.length; index++) {
					const word = words[index].word.word.trim();
					if (word.includes(" ") || !/[-–—]/.test(word)) continue;
					const segmentLengths = word.split(/[-–—]/).map((part) => part.length);
					if (segmentLengths.every((length) => length <= 2)) continue;
					const neighbor = words[index + 1] ?? words[index - 1];
					if (!neighbor) continue;
					if (
						!isValidTiming(
							words[index].word.startTime,
							words[index].word.endTime,
						) ||
						!isValidTiming(neighbor.word.startTime, neighbor.word.endTime) ||
						Math.abs(words[index].word.endTime - neighbor.word.startTime) > 50
					) {
						continue;
					}
					issues.push(
						finding(
							lineIndex,
							`"${word}" contains a visible hyphen beside another timed part. Check that the hyphen belongs to the transcription, not just the split.`,
							{ wordIndex: words[index].index },
						),
					);
				}
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "single-background-line",
		level: "required",
		category: "vocal-roles",
		message: "A duet/primary line cannot have only one background line",
		fixHint:
			"Complete the background phrase or write the supporting vocal as a main line when it is the only one. A background line after another background line is allowed.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			const lines = lyric.lyricLines;
			for (let index = 0; index < lines.length; index++) {
				if (!lines[index].isBG) continue;
				let end = index;
				while (end + 1 < lines.length && lines[end + 1].isBG) end += 1;
				const length = end - index + 1;
				if (index > 0 && length === 1 && !lines[index - 1].isBG) {
					issues.push(
						finding(
							index,
							"This background line is the only background line for the duet/primary line above it. Add the rest of the background phrase or make it a main line.",
						),
					);
				}
				index = end;
			}
			return issues;
		},
	},
	{
		id: "background-at-section-start",
		level: "required",
		category: "vocal-roles",
		message: "A duet/primary section cannot begin with a background line",
		fixHint:
			"Move the background line under the main vocal it supports, or make it a main line if it starts the section. A song may start with a background line.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			const lines = lyric.lyricLines;
			for (let index = 1; index < lines.length; index++) {
				const line = lines[index];
				const previous = lines[index - 1];
				if (!line.isBG || !line.sectionId) continue;
				if (previous.sectionId === line.sectionId) continue;
				issues.push(
					finding(
						index,
						"This section starts with a background line. Attach it to the main line it supports, or write it as a main line.",
					),
				);
			}
			return issues;
		},
	},
	{
		id: "duet-side",
		level: "recommended",
		category: "vocal-roles",
		message: "Confirm background vocals stay on the same duet side",
		fixHint:
			"Check which singer performs the background line. The same singer should stay on the same side throughout.",
		check: ({ lyric }) => {
			const issues: SubmissionFinding[] = [];
			let mainLine: LyricLine | null = null;
			lyric.lyricLines.forEach((line, lineIndex) => {
				if (!line.isBG) {
					mainLine = line;
					return;
				}
				if (!mainLine) return;
				if (isVoiceRightAligned(line) === isVoiceRightAligned(mainLine)) {
					return;
				}
				issues.push(
					finding(
						lineIndex,
						"This background line is on the opposite duet side from the lead line it supports. Confirm that this is the same singer and side.",
					),
				);
			});
			return issues;
		},
		dismissible: true,
	},
	{
		id: "romanization-supported",
		level: "recommended",
		category: "romanization",
		message: "Romanization is recommended for this language",
		fixHint:
			"Add maker-supplied, human-verified Romanization when Spicy Lyrics supports the language. If you do not have a verified Romanization, a reviewer can help.",
		check: (context) => {
			if (
				!context.projectLanguage ||
				!ROMANIZATION_LANGUAGE_CODES.has(context.projectLanguage)
			) {
				return [];
			}
			if (hasRomanization(context.lyric)) return [];
			const line = context.lyric.lyricLines.find(hasLyricText);
			if (!line) return [];
			return [
				finding(
					context.lyric.lyricLines.indexOf(line),
					`Spicy Lyrics supports Romanization for ${context.projectLanguage}, but none is present. Add a human-verified Romanization if you can.`,
				),
			];
		},
	},
	{
		id: "romanization-review",
		level: "required",
		category: "romanization",
		message: "Check the Romanization before submitting",
		fixHint:
			"Read through the Romanization against the recording, fix inaccurate readings, then mark this reminder as checked for the project.",
		check: (context) => {
			if (!hasRomanization(context.lyric)) return [];
			return [
				finding(
					0,
					"Romanization is present. Check automatic readings and correct any that do not match the recording, then mark this item checked.",
				),
			];
		},
		dismissible: true,
		actionLabel: "Mark checked",
	},
];

export const SUBMISSION_MANUAL_SECTIONS: SubmissionManualSection[] = [
	{
		id: "lyrics-recording",
		title: "Lyrics and recording",
		items: [
			{
				id: "listened-exact-recording",
				label:
					"I listened through the exact recording and corrected every line. Copied lyrics (Genius, Spotify, booklets) were checked against the audio, since even artist-verified lyrics can be wrong.",
			},
			{
				id: "included-spoken-content",
				label:
					"I included intelligible ad-libs, background vocals, dialogue samples, producer tags, radio clips, and crowd chants.",
			},
			{
				id: "original-language-script",
				label:
					"I used the original language and native writing system for the main lyrics.",
			},
			{
				id: "vocal-roles-by-ear",
				label:
					"I marked vocal roles by listening (background and duet), not just by guessing from parentheses.",
			},
			{
				id: "repeated-lyrics-in-full",
				label: "Repeated lyrics are written in full at every occurrence.",
			},
		],
	},
	{
		id: "timing",
		title: "Timing",
		items: [
			{
				id: "timing-whole-song",
				label:
					"I checked timing through the whole song, including the beginning and end. A consistent early/late offset was fixed with Time Shift, and timing that varies was retimed line by line.",
			},
			{
				id: "verified-imported-timing",
				label:
					"Timing copied or imported from another TTML (including Apple Music) was independently verified, because an existing sync is only a starting point.",
			},
			{
				id: "no-ai-transcription-or-timing",
				label:
					"I did not use AI-generated lyric transcription or AI-generated lyric timing. Built-in tool automation is allowed only if I checked and corrected the result, and AI audio separation as a listening aid is allowed.",
			},
			{
				id: "checked-automatic-splits",
				label: "Any automatic splits were checked against the recording.",
			},
		],
	},
	{
		id: "testing",
		title: "Testing",
		items: [
			{
				id: "local-test",
				label:
					"I ran a local test: Lyrics Manager > Upload TTML > Temporary or Persistent upload, confirmed the file parses and every line appears, then played the complete song with the original audio checking word and line timing, background and duet roles, line breaks, Romanization, metadata, and the start and end of the song.",
			},
			{
				id: "exact-streamed-variant",
				label:
					"I tested against the exact streamed song variant I'm submitting for. A local copy alone isn't enough for final verification.",
			},
			{
				id: "cleared-cache-and-verified",
				label:
					"After uploading, I cleared the Spicy Lyrics cache before opening the song, and verified the real result.",
			},
		],
	},
	{
		id: "variants-ownership",
		title: "Variants, duplicates, and ownership",
		items: [
			{
				id: "checked-existing-work",
				label:
					"I checked for existing work: the #ttml-uploads forum (if I have access), the live song in Spicy Lyrics, and alternate releases (single, album, deluxe, compilation, clean, explicit).",
			},
			{
				id: "material-improvement",
				label:
					"If a good sync already exists, I'm only replacing it because I made a material improvement, not for visibility, views, or credit.",
			},
			{
				id: "separate-versions",
				label:
					"Different versions (different audio, lyrics, censorship, offsets, intros, edits, or timing) each have their own TTML.",
			},
			{
				id: "ownership-permission",
				label:
					"This is my own synchronization, or I have permission. I'm not submitting someone else's sync as mine.",
			},
		],
	},
];

export const SUBMISSION_ROUTES: SubmissionRoute[] = [
	{
		id: "no-role",
		label: "No TTML Maker role",
		steps: [
			"New TTML Maker role applications (tickets) are currently closed.",
			"Upload locally using the local test steps above: Upload TTML > Temporary or Persistent upload.",
			"Confirm the file parses and every line appears, then play the complete song against the original audio.",
			"Clear the Spicy Lyrics cache and verify the real result.",
		],
	},
	{
		id: "maker",
		label: "TTML Maker role",
		steps: [
			"Create one post in #ttml-uploads.",
			"Attach the TTML and include the exact song link.",
			"Send each genuinely different version as its own message with its own TTML and link.",
			"Correct every blocking issue in the same post and send the revised file.",
			"After the reviewer confirms the upload, clear the Spicy Lyrics cache and verify the result.",
			"Corrections need a response within about 3 weeks.",
		],
	},
	{
		id: "self-uploader",
		label: "Self-Uploader role",
		steps: [
			"Use /upload-ttml with the TTML file attached.",
			"Confirm the TTML is associated with the intended Spotify target ID(s).",
			"Clear the Spicy Lyrics cache and verify the uploaded result in Spicy Lyrics.",
		],
	},
];

export const getSubmissionRoute = (
	id: SubmissionRoute["id"],
): SubmissionRoute => {
	const route = SUBMISSION_ROUTES.find((candidate) => candidate.id === id);
	if (route) return route;
	const fallback = SUBMISSION_ROUTES[0];
	if (!fallback) throw new Error("No submission routes are configured");
	return fallback;
};
