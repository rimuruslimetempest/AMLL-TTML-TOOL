import { normalizeVoice, type TTMLLyric } from "$/types/ttml";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import type { AiCheckIssue } from "./types";

export const MIN_SYLLABLE_MS = 40;
export const MAX_SYLLABLE_MS = 8000;
export const MAX_SYLLABLE_GAP_MS = 1500;

const WHITESPACE_ONLY = /^\s*$/;

const formatMs = (value: number) => `${Math.round(value)} ms`;

/**
 * Fast, offline validation of a word-synced project. Every issue carries the
 * 1-based line number so the panel can jump straight to it.
 */
export function runLocalChecks(lyric: TTMLLyric, ttml: string): AiCheckIssue[] {
	const issues: AiCheckIssue[] = [];
	let sequence = 0;
	const displayNumbers = getLineDisplayNumbers(lyric.lyricLines);
	let activeLineIndex = -1;
	let activeLineNumber = -1;
	const push = (
		issue: Omit<AiCheckIssue, "id" | "source"> & { rule: string },
	) => {
		const { rule, ...rest } = issue;
		const lineIndex =
			rest.lineIndex ??
			(rest.line === activeLineNumber ? activeLineIndex : undefined);
		issues.push({
			...rest,
			...(lineIndex !== undefined ? { lineIndex } : {}),
			id: `local:${rule}:${rest.line}:${rest.syllableIndex ?? "-"}:${sequence++}`,
			source: "local",
		});
	};

	let previousStart = Number.NEGATIVE_INFINITY;
	let previousStartLine = 0;

	lyric.lyricLines.forEach((line, lineIndex) => {
		const lineNumber = displayNumbers[lineIndex] ?? lineIndex + 1;
		activeLineIndex = lineIndex;
		activeLineNumber = lineNumber;
		const hasText = line.words.some(
			(word) => word.word.trim().length > 0 || word.romanWord.trim().length > 0,
		);
		const timedWords = line.words.filter(
			(word) => word.startTime > 0 || word.endTime > 0,
		);

		if (!line.ignoreSync) {
			if (hasText && line.startTime <= 0 && line.endTime <= 0) {
				if (timedWords.length === 0) {
					push({
						rule: "line-untimed",
						line: lineNumber,
						severity: "error",
						type: "timing",
						message: "Line has no timing at all.",
					});
				}
			} else if (line.endTime > 0 && line.endTime <= line.startTime) {
				push({
					rule: "line-inverted",
					line: lineNumber,
					severity: "error",
					type: "timing",
					message: `Line ends at ${formatMs(line.endTime)} but starts at ${formatMs(
						line.startTime,
					)}.`,
				});
			}

			if (
				!line.isBG &&
				line.startTime > 0 &&
				line.startTime < previousStart - 1
			) {
				push({
					rule: "line-order",
					line: lineNumber,
					severity: "warning",
					type: "timing",
					message: `Line starts earlier (${formatMs(
						line.startTime,
					)}) than the previous line ${previousStartLine} (${formatMs(
						previousStart,
					)}).`,
				});
			}
			if (!line.isBG && line.startTime > 0) {
				previousStart = line.startTime;
				previousStartLine = lineNumber;
			}
		}

		const agent = line.agent?.trim();
		if (agent) {
			if (!/^v\d+$/i.test(agent)) {
				push({
					rule: "agent-format",
					line: lineNumber,
					severity: "warning",
					type: "format",
					message: `Agent tag "${agent}" is not a valid voice id (expected v1, v2, ...).`,
				});
			} else if (normalizeVoice(agent) !== agent) {
				push({
					rule: "agent-normalize",
					line: lineNumber,
					severity: "suggestion",
					type: "format",
					message: `Agent tag "${agent}" should be written as "${normalizeVoice(agent)}".`,
				});
			}
			if (!line.isDuet && normalizeVoice(agent) !== "v1") {
				push({
					rule: "agent-duet",
					line: lineNumber,
					severity: "suggestion",
					type: "format",
					message: `Line is tagged ${agent} but is not marked as a duet line.`,
				});
			}
		} else if (line.isDuet) {
			push({
					rule: "agent-missing",
					line: lineNumber,
					severity: "warning",
					type: "format",
					message: "Duet line has no agent tag (expected v2).",
				});
		}

		const ordered: Array<{ index: number; start: number; end: number }> = [];
		line.words.forEach((word, wordIndex) => {
			const text = word.word;
			const syllableIndex = wordIndex;

			if (text === "") {
				push({
					rule: "text-empty",
					line: lineNumber,
					syllableIndex,
					severity: "warning",
					type: "text",
					message: "Syllable text is empty.",
				});
			} else if (!WHITESPACE_ONLY.test(text)) {
				if (/^\s|\s$/.test(text) || /\s{2,}/.test(text)) {
					const trimmed = text.trim().replace(/\s+/g, " ");
					push({
						rule: "text-whitespace",
						line: lineNumber,
						syllableIndex,
						severity: "suggestion",
						type: "text",
						message: `Syllable "${text}" has stray whitespace.`,
						suggestedFix: `Use "${trimmed}".`,
						fix: { kind: "syllableText", text: trimmed },
					});
				}
			}

			if (line.ignoreSync) return;
			if (word.startTime === 0 && word.endTime === 0) return;
			if (word.endTime > 0 && word.endTime <= word.startTime) {
				push({
					rule: "word-inverted",
					line: lineNumber,
					syllableIndex,
					severity: "error",
					type: "timing",
					message: `Syllable ends at ${formatMs(word.endTime)} but starts at ${formatMs(
						word.startTime,
					)}.`,
				});
				return;
			}

			const duration = word.endTime - word.startTime;
			if (word.endTime > 0 && duration < MIN_SYLLABLE_MS) {
				push({
					rule: "word-short",
					line: lineNumber,
					syllableIndex,
					severity: "warning",
					type: "timing",
					message: `Syllable is only ${formatMs(duration)} long.`,
				});
			}
			if (duration > MAX_SYLLABLE_MS) {
				push({
					rule: "word-long",
					line: lineNumber,
					syllableIndex,
					severity: "warning",
					type: "timing",
					message: `Syllable is ${formatMs(duration)} long.`,
				});
			}

			if (line.endTime > line.startTime) {
				if (word.startTime < line.startTime - 1) {
					push({
						rule: "word-before-line",
						line: lineNumber,
						syllableIndex,
						severity: "warning",
						type: "timing",
						message: `Syllable starts before the line begins (${formatMs(
							line.startTime,
						)}).`,
					});
				}
				if (word.endTime > line.endTime + 1) {
					push({
						rule: "word-after-line",
						line: lineNumber,
						syllableIndex,
						severity: "warning",
						type: "timing",
						message: `Syllable ends after the line ends (${formatMs(
							line.endTime,
						)}).`,
					});
				}
			}

			if (word.startTime > 0) {
				ordered.push({ index: syllableIndex, start: word.startTime, end: word.endTime });
			}
		});

		ordered.sort((a, b) => a.start - b.start || a.index - b.index);
		for (let i = 1; i < ordered.length; i++) {
			const previous = ordered[i - 1];
			const current = ordered[i];
			if (previous.end > 0 && current.start < previous.end - 1) {
				push({
					rule: "word-overlap",
					line: lineNumber,
					syllableIndex: current.index,
					severity: "error",
					type: "timing",
					message: `Syllable starts ${formatMs(
						previous.end - current.start,
					)} before the previous one ends.`,
				});
			} else if (previous.end > 0 && current.start - previous.end > MAX_SYLLABLE_GAP_MS) {
				push({
					rule: "word-gap",
					line: lineNumber,
					syllableIndex: current.index,
					severity: "warning",
					type: "timing",
					message: `Gap of ${formatMs(
						current.start - previous.end,
					)} before this syllable (possible missing sync).`,
				});
			}
		}
	});

	activeLineIndex = -1;
	activeLineNumber = -1;

	// Document-level checks on the serialized TTML.
	if (!/<tt\b/.test(ttml)) {
		push({
			rule: "xml-root",
			line: 1,
			severity: "error",
			type: "format",
			message: "Exported TTML is missing the <tt> root element.",
		});
	} else if (!ttml.includes('xmlns="http://www.w3.org/ns/ttml"')) {
		push({
			rule: "xml-xmlns",
			line: 1,
			severity: "error",
			type: "format",
			message: "TTML root is missing the xmlns attribute.",
		});
	}
	if (!ttml.includes('itunes:timing="Word"')) {
		push({
			rule: "xml-timing",
			line: 1,
			severity: "warning",
			type: "format",
			message: 'TTML is missing itunes:timing="Word" (word-level timing marker).',
		});
	}

	if (typeof DOMParser !== "undefined") {
		try {
			const parsed = new DOMParser().parseFromString(ttml, "application/xml");
			if (parsed.getElementsByTagName("parsererror").length > 0) {
				push({
					rule: "xml-malformed",
					line: 1,
					severity: "error",
					type: "format",
					message: "Exported TTML is not well-formed XML.",
				});
			}
		} catch {
			push({
				rule: "xml-malformed",
				line: 1,
				severity: "error",
				type: "format",
				message: "Exported TTML could not be parsed as XML.",
			});
		}
	}

	const hasBgSpans = /ttm:role="x-bg"/.test(ttml);
	const hasBgLines = lyric.lyricLines.some((line) => line.isBG);
	if (hasBgLines && !hasBgSpans) {
		push({
			rule: "bg-missing-span",
			line: 1,
			severity: "warning",
			type: "format",
			message:
				"Project has background vocal lines, but the exported TTML contains no ttm:role=\"x-bg\" spans.",
		});
	} else if (hasBgSpans && !hasBgLines) {
		push({
			rule: "bg-unexpected-span",
			line: 1,
			severity: "warning",
			type: "format",
			message:
				"Exported TTML contains background vocal spans, but no line is marked as background.",
		});
	}

	return issues;
}