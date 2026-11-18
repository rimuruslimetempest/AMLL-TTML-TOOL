export type LyricFormat = "lrc" | "eslrc" | "srt" | "ass" | "vtt" | "plain";

export interface ParsedWord {
	text: string;
	startTime: number;
	endTime: number;
}

export interface ParsedLine {
	text: string;
	startTime: number;
	endTime: number;
	words?: ParsedWord[];
}

export interface ParseResult {
	format: LyricFormat;
	formatLabel: string;
	lines: ParsedLine[];
	warnings: string[];
	hasWordTiming: boolean;
}

const FORMAT_LABEL: Record<LyricFormat, string> = {
	lrc: "LRC",
	eslrc: "Enhanced LRC",
	srt: "SRT",
	ass: "ASS/SSA",
	vtt: "WebVTT",
	plain: "Plain text",
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function formatTimestamp(ms: number, separator: "dot" | "comma" = "dot") {
	const safe = Math.max(0, Math.round(ms));
	const hours = Math.floor(safe / 3_600_000);
	const minutes = Math.floor((safe % 3_600_000) / 60_000);
	const seconds = Math.floor((safe % 60_000) / 1000);
	const millis = safe % 1000;
	const fraction =
		separator === "comma" ? pad(millis, 3) : pad(Math.floor(millis / 10));
	return `${hours > 0 ? `${pad(hours)}:` : ""}${pad(minutes)}:${pad(seconds)}${separator === "comma" ? "," : "."}${fraction}`;
}

export function formatSubtitleTimestamp(ms: number) {
	const safe = Math.max(0, Math.round(ms));
	const hours = Math.floor(safe / 3_600_000);
	const minutes = Math.floor((safe % 3_600_000) / 60_000);
	const seconds = Math.floor((safe % 60_000) / 1000);
	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(safe % 1000, 3)}`;
}

export function parseTimestamp(value: string): number | null {
	const trimmed = value.trim();
	const bracket = trimmed.match(/^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]$/);
	if (bracket) {
		const fraction = bracket[3] ?? "0";
		const milliseconds =
			fraction.length === 1
				? Number(fraction) * 100
				: fraction.length === 2
					? Number(fraction) * 10
					: Number(fraction);
		return (
			Number(bracket[1]) * 60_000 +
			Number(bracket[2]) * 1000 +
			milliseconds
		);
	}
	const subtitle = trimmed.match(
		/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/,
	);
	if (subtitle) {
		const fraction = subtitle[4] ?? "0";
		const milliseconds =
			fraction.length === 1
				? Number(fraction) * 100
				: fraction.length === 2
					? Number(fraction) * 10
					: Number(fraction);
		return (
			(Number(subtitle[1] ?? 0) * 3600 + Number(subtitle[2]) * 60) * 1000 +
			Number(subtitle[3]) * 1000 +
			milliseconds
		);
	}
	return null;
}

/** Decode UTF-8 (with or without BOM), UTF-16LE/BE, or fall back to UTF-8. */
export function decodeLyricBytes(bytes: ArrayBuffer): {
	text: string;
	encoding: string;
} {
	const view = new DataView(bytes);
	if (bytes.byteLength >= 2) {
		const first = view.getUint8(0);
		const second = view.getUint8(1);
		if (first === 0xff && second === 0xfe) {
			return {
				text: new TextDecoder("utf-16le").decode(bytes.slice(2)),
				encoding: "UTF-16LE",
			};
		}
		if (first === 0xfe && second === 0xff) {
			return {
				text: new TextDecoder("utf-16be").decode(bytes.slice(2)),
				encoding: "UTF-16BE",
			};
		}
		if (first === 0xef && second === 0xbb) {
			return {
				text: new TextDecoder("utf-8").decode(bytes.slice(3)),
				encoding: "UTF-8 with BOM",
			};
		}
	}
	const text = new TextDecoder("utf-8").decode(bytes);
	return { text: text.replace(/^\uFEFF/, ""), encoding: "UTF-8" };
}

export function detectFormat(fileName: string, text: string): LyricFormat {
	const ext = fileName.split(".").pop()?.toLowerCase();
	if (ext === "lrc") {
		return /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/.test(text) ? "eslrc" : "lrc";
	}
	if (ext === "srt") return "srt";
	if (ext === "ass" || ext === "ssa") return "ass";
	if (ext === "vtt") return "vtt";
	if (ext === "txt") return "plain";
	if (/^WEBVTT\b/im.test(text)) return "vtt";
	if (/^\s*\[Script Info\]/im.test(text)) return "ass";
	if (/^\s*\d+\s*$/m.test(text) && /-->/.test(text)) return "srt";
	if (/\[(?:ar|ti|al|by|offset):/i.test(text) || /\[\d{1,2}:\d{2}/.test(text))
		return "lrc";
	return "plain";
}

function stripAssTags(text: string) {
	return text.replace(/\{[^}]*\}/g, "").replace(/\\N/gi, "\n").trim();
}

/** Fill missing end times from the next line without changing starts. */
function fillEnds(lines: ParsedLine[]) {
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line.endTime > line.startTime) continue;
		const next = lines
			.slice(index + 1)
			.find((candidate) => candidate.startTime > line.startTime);
		line.endTime = next
			? next.startTime
			: line.startTime > 0
				? line.startTime + 3000
				: 0;
		for (const word of line.words ?? []) {
			if (word.endTime <= word.startTime)
				word.endTime = Math.min(line.endTime, word.startTime + 1000);
		}
	}
}

export function parseLrc(text: string, enhanced = false): ParseResult {
	const warnings: string[] = [];
	const lines: ParsedLine[] = [];
	let hasWordTiming = false;
	const lrcLine = /^\s*((?:\[(?:\d{1,2}):\d{1,2}(?:[.:]\d{1,3})?\])+)(.*)$/;
	const wordTag = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

	for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
		const match = rawLine.match(lrcLine);
		if (!match) continue;
		const textPart = match[2].trim();
		if (!textPart) continue;
		const stamps = [...match[1].matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
		const wordMatches = [...textPart.matchAll(wordTag)];
		const wordTimes =
			enhanced && wordMatches.length > 0
				? wordMatches.map((word) => {
						const fraction = word[3] ?? "0";
						return (
							Number(word[1]) * 60_000 +
							Number(word[2]) * 1000 +
							(fraction.length === 1
								? Number(fraction) * 100
								: fraction.length === 2
									? Number(fraction) * 10
									: Number(fraction))
						);
					})
				: [];
		if (wordMatches.length > 0) hasWordTiming = true;
		const plainText = textPart.replace(wordTag, "").trim();
		if (!plainText) continue;

		const builtWords = wordTimes.map((time, wordIndex) => {
			const nextTime = wordTimes[wordIndex + 1] ?? 0;
			const tagMatch = wordMatches[wordIndex];
			const segmentStart = (tagMatch.index ?? 0) + tagMatch[0].length;
			const segmentEnd =
				wordMatches[wordIndex + 1]?.index ?? textPart.length;
			return {
				text: textPart.slice(segmentStart, segmentEnd).trim(),
				startTime: time,
				endTime: nextTime > time ? nextTime : time + 500,
			};
		});

		for (const stamp of stamps) {
			const fraction = stamp[3] ?? "0";
			const startTime =
				Number(stamp[1]) * 60_000 +
				Number(stamp[2]) * 1000 +
				(fraction.length === 1
					? Number(fraction) * 100
					: fraction.length === 2
						? Number(fraction) * 10
						: Number(fraction));
			lines.push({
				text: plainText,
				startTime,
				endTime: 0,
				words: builtWords.length > 0 ? builtWords.map((word) => ({ ...word })) : undefined,
			});
		}
		if (stamps.length === 0 && textPart && !/^\[[a-z]+:/i.test(rawLine)) {
			warnings.push(`Line ${index + 1} has no timestamp and was skipped.`);
		}
	}

	fillEnds(lines);
	return {
		format: enhanced || hasWordTiming ? "eslrc" : "lrc",
		formatLabel: FORMAT_LABEL[enhanced || hasWordTiming ? "eslrc" : "lrc"],
		lines,
		warnings,
		hasWordTiming,
	};
}

export function parseSrt(text: string): ParseResult {
	const warnings: string[] = [];
	const lines: ParsedLine[] = [];
	const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
	const timeLine = /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;
	for (const block of blocks) {
		const blockLines = block.split("\n").filter((line) => line.trim());
		if (blockLines.length === 0) continue;
		const index = blockLines.findIndex((line) => timeLine.test(line));
		if (index < 0) {
			warnings.push(`Skipped a block without a valid timestamp: "${blockLines[0]}"`);
			continue;
		}
		const match = blockLines[index].match(timeLine);
		if (!match) continue;
		const startTime = parseTimestamp(match[1].replace(",", "."));
		const endTime = parseTimestamp(match[2].replace(",", "."));
		const textLines = blockLines.slice(index + 1).join("\n").trim();
		if (startTime === null || endTime === null) {
			warnings.push(`Skipped a cue with an unreadable timestamp.`);
			continue;
		}
		lines.push({ text: textLines, startTime, endTime });
	}
	fillEnds(lines);
	return {
		format: "srt",
		formatLabel: FORMAT_LABEL.srt,
		lines,
		warnings,
		hasWordTiming: false,
	};
}

export function parseAss(text: string): ParseResult {
	const warnings: string[] = [];
	const lines: ParsedLine[] = [];
	let inEvents = false;
	for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
		const trimmed = rawLine.trim();
		if (/^\[Events\]/i.test(trimmed)) {
			inEvents = true;
			continue;
		}
		if (/^\[/.test(trimmed)) {
			inEvents = false;
			continue;
		}
		if (!inEvents || !/^Dialogue\s*:/i.test(trimmed)) continue;
		const fields = trimmed.slice(trimmed.indexOf(":") + 1).split(",");
		if (fields.length < 10) {
			warnings.push("Skipped a Dialogue line with fewer than 10 fields.");
			continue;
		}
		const start = parseTimestamp(fields[1]);
		const end = parseTimestamp(fields[2]);
		const textPart = stripAssTags(fields.slice(9).join(","));
		if (start === null || end === null) {
			warnings.push(`Skipped a Dialogue line with an unreadable timestamp.`);
			continue;
		}
		if (!textPart) continue;
		lines.push({ text: textPart, startTime: start, endTime: end });
	}
	fillEnds(lines);
	return {
		format: "ass",
		formatLabel: FORMAT_LABEL.ass,
		lines,
		warnings,
		hasWordTiming: false,
	};
}

export function parseVtt(text: string): ParseResult {
	const warnings: string[] = [];
	const lines: ParsedLine[] = [];
	const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
	const timeLine = /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/;
	for (const block of blocks) {
		const blockLines = block.split("\n").filter((line) => line.trim());
		if (blockLines.length === 0 || /^WEBVTT/i.test(blockLines[0])) continue;
		const index = blockLines.findIndex((line) => timeLine.test(line));
		if (index < 0) {
			warnings.push(`Skipped a VTT block without a valid timestamp.`);
			continue;
		}
		const match = blockLines[index].match(timeLine);
		if (!match) continue;
		const normalizedStart = match[1].replace(",", ".").replace(/^(\d{2}:\d{2}\.)/, "00:$1");
		const normalizedEnd = match[2].replace(",", ".").replace(/^(\d{2}:\d{2}\.)/, "00:$1");
		const start = parseTimestamp(normalizedStart);
		const end = parseTimestamp(normalizedEnd);
		const textPart = blockLines.slice(index + 1).join("\n").trim();
		if (start === null || end === null) {
			warnings.push(`Skipped a VTT cue with an unreadable timestamp.`);
			continue;
		}
		if (textPart) lines.push({ text: textPart, startTime: start, endTime: end });
	}
	fillEnds(lines);
	return {
		format: "vtt",
		formatLabel: FORMAT_LABEL.vtt,
		lines,
		warnings,
		hasWordTiming: false,
	};
}

export function parsePlainText(text: string): ParseResult {
	const lines = text
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => ({ text: line, startTime: 0, endTime: 0 }));
	return {
		format: "plain",
		formatLabel: FORMAT_LABEL.plain,
		lines,
		warnings: [],
		hasWordTiming: false,
	};
}

export function parseLyricText(
	fileName: string,
	text: string,
	format?: LyricFormat,
): ParseResult {
	const resolved = format ?? detectFormat(fileName, text);
	switch (resolved) {
		case "lrc":
			return parseLrc(text, false);
		case "eslrc":
			return parseLrc(text, true);
		case "srt":
			return parseSrt(text);
		case "ass":
			return parseAss(text);
		case "vtt":
			return parseVtt(text);
		default:
			return parsePlainText(text);
	}
}
