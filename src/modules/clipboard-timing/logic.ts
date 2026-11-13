import type { LyricLine } from "$/types/ttml";
import type {
	ClipboardPayload,
	ClipboardWordTiming,
	LineFullClipboard,
	LineTextClipboard,
	LineTimingClipboard,
	PasteMode,
	PasteOptions,
	PastePreview,
} from "./types";

export function lineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("");
}

export function timedWordCount(line: LyricLine): number {
	return line.words.filter((word) => word.endTime > word.startTime).length;
}

export function buildLineTimingClipboard(
	line: LyricLine,
	now = Date.now(),
): LineTimingClipboard {
	return {
		kind: "line-timing",
		version: 1,
		sourceLineId: line.id,
		text: lineText(line),
		startTime: line.startTime,
		endTime: line.endTime,
		words: line.words.map((word) => ({
			word: word.word,
			startTime: word.startTime,
			endTime: word.endTime,
		})),
		copiedAt: now,
	};
}

export function buildLineTextClipboard(
	line: LyricLine,
	now = Date.now(),
): LineTextClipboard {
	return {
		kind: "line-text",
		version: 1,
		text: lineText(line),
		copiedAt: now,
	};
}

export function buildLineFullClipboard(
	line: LyricLine,
	now = Date.now(),
): LineFullClipboard {
	return {
		kind: "line-full",
		version: 1,
		text: lineText(line),
		startTime: line.startTime,
		endTime: line.endTime,
		words: line.words.map((word) => ({
			word: word.word,
			startTime: word.startTime,
			endTime: word.endTime,
		})),
		isBG: line.isBG,
		isDuet: line.isDuet,
		agent: line.agent,
		language: line.language,
		translatedLyric: line.translatedLyric ?? "",
		romanLyric: line.romanLyric ?? "",
		copiedAt: now,
	};
}

export function isTimingClipboard(
	payload: ClipboardPayload | null,
): payload is LineTimingClipboard {
	return payload?.kind === "line-timing";
}

export function isLineFullClipboard(
	payload: ClipboardPayload | null,
): payload is LineFullClipboard {
	return payload?.kind === "line-full";
}

/** True when the clipboard can supply text to insert as a new line. */
export function clipboardText(payload: ClipboardPayload | null): string {
	if (!payload) return "";
	return payload.kind === "line-text" ? payload.text : payload.text;
}

function sourceSpan(words: ClipboardWordTiming[]): {
	start: number;
	end: number;
} {
	let start = Number.POSITIVE_INFINITY;
	let end = 0;
	for (const word of words) {
		if (word.endTime > word.startTime) {
			start = Math.min(start, word.startTime);
			end = Math.max(end, word.endTime);
		}
	}
	if (!Number.isFinite(start) || end <= start) return { start: 0, end: 0 };
	return { start, end };
}

/**
 * Builds the resulting word times without touching the document. The caller
 * shows this preview before applying anything.
 */
export function buildPastePreview(
	target: LyricLine,
	source: LineTimingClipboard,
	options: PasteOptions,
): PastePreview {
	const sourceWords = source.words;
	const span = sourceSpan(sourceWords);
	const base = options.relative ? options.startAt : 0;
	const targetCount = target.words.length;
	const sourceCount = sourceWords.length;

	const rows = target.words.map((word, index) => {
		let start = 0;
		let end = 0;
		if (options.mode === "stretch" && sourceCount > 0 && span.end > span.start) {
			const first = index / Math.max(1, targetCount);
			const last = (index + 1) / Math.max(1, targetCount);
			start = span.start + (span.end - span.start) * first;
			end = span.start + (span.end - span.start) * last;
		} else if (index < sourceCount) {
			start = sourceWords[index].startTime;
			end = sourceWords[index].endTime;
		}
		const timed = end > start;
		if (timed && options.relative) {
			start = base + (start - span.start);
			end = base + (end - span.start);
		}
		if (timed && options.offsetMs !== 0) {
			start += options.offsetMs;
			end += options.offsetMs;
		}
		return {
			wordId: word.id,
			text: word.word,
			startTime: Math.max(0, Math.round(start)),
			endTime: Math.max(0, Math.round(end)),
			wasTimed: word.endTime > word.startTime,
		};
	});

	return {
		rows,
		sourceCount,
		targetCount,
		mismatch:
			sourceCount !== targetCount ||
			sourceWords.some(
				(word, index) => target.words[index]?.word !== word.word,
			),
	};
}

/** Applies an already-previewed plan to one line, marking pasted words for review. */
export function applyPastePreview(
	target: LyricLine,
	preview: PastePreview,
): LyricLine {
	const rows = new Map(preview.rows.map((row) => [row.wordId, row] as const));
	const words = target.words.map((word) => {
		const row = rows.get(word.id);
		if (!row || row.endTime <= row.startTime) return word;
		return {
			...word,
			startTime: row.startTime,
			endTime: row.endTime,
			needsReview: true,
		};
	});
	let start = Number.POSITIVE_INFINITY;
	let end = 0;
	for (const word of words) {
		if (word.endTime > word.startTime) {
			start = Math.min(start, word.startTime);
			end = Math.max(end, word.endTime);
		}
	}
	return {
		...target,
		words,
		startTime: Number.isFinite(start) ? start : target.startTime,
		endTime: end > 0 ? end : target.endTime,
	};
}

/** Text-only paste: tokens keep their spacing, timings are left as they were. */
export function replaceLineText(
	target: LyricLine,
	text: string,
	makeWord: () => { id: string },
): LyricLine {
	const tokens = text.split(/(\s+)/).filter((token) => token.length > 0);
	const words = tokens.map((token) => ({
		...makeWord(),
		word: token,
		startTime: 0,
		endTime: 0,
		obscene: false,
		romanWord: "",
		needsReview: true,
	}));
	return {
		...target,
		words,
		startTime: 0,
		endTime: 0,
		isLineSynced: false,
	};
}

export function pasteModeLabel(mode: PasteMode): string {
	return mode === "stretch" ? "Stretch to fit" : "Match by position";
}
