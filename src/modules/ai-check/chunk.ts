import {
	AI_CHECK_ISSUE_TYPES,
	AI_CHECK_SEVERITIES,
	type AiCheckIssue,
	type AiCheckIssueType,
	type AiCheckSeverity,
} from "./types";

export const AI_CHECK_CHUNK_LINES = 40;
export const AI_CHECK_CHUNK_OVERLAP = 2;

export interface TtmlChunk {
	startLine: number;
	endLine: number;
	text: string;
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

const PARAGRAPH_PATTERN = /<p\b[\s\S]*?<\/p>/g;

export function countTtmlParagraphs(ttml: string): number {
	return ttml.match(PARAGRAPH_PATTERN)?.length ?? 0;
}

/**
 * Splits the exported TTML into line chunks with a small overlap so a mistake
 * spanning a chunk boundary is still visible to the model. Each line is
 * prefixed with its global 1-based number, which the model must echo back.
 */
export function splitTtmlIntoChunks(
	ttml: string,
	chunkSize = AI_CHECK_CHUNK_LINES,
	overlap = AI_CHECK_CHUNK_OVERLAP,
): TtmlChunk[] {
	const paragraphs = ttml.match(PARAGRAPH_PATTERN) ?? [];
	if (paragraphs.length === 0) {
		return [{ startLine: 1, endLine: 1, text: ttml }];
	}

	const size = Math.max(1, chunkSize);
	const step = Math.max(1, size - Math.max(0, overlap));
	const chunks: TtmlChunk[] = [];

	for (let start = 0; start < paragraphs.length; start += step) {
		const end = Math.min(paragraphs.length, start + size);
		const lines = paragraphs
			.slice(start, end)
			.map((line, offset) => `[line ${start + offset + 1}] ${line}`);
		chunks.push({
			startLine: start + 1,
			endLine: end,
			text: [
				'<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal">',
				"<body>",
				...lines,
				"</body>",
				"</tt>",
			].join("\n"),
		});
		if (end === paragraphs.length) break;
	}

	return chunks;
}

export function buildAiCheckMessages(
	chunk: TtmlChunk,
	localIssues: AiCheckIssue[],
): ChatMessage[] {
	const system = [
		"You are a strict lyric-timing QA reviewer for Apple Music style word-synced TTML.",
		"You cannot hear the audio, so judge timing only from internal consistency and from text length versus duration.",
		"Check for: likely typos or misspelled lyrics; words split at wrong syllable boundaries; misplaced spaces between words;",
		"implausible timing (a long word in a tiny duration or a short word in a huge duration); inconsistent capitalization or punctuation between lines;",
		"and background vocals (ttm:role=\"x-bg\") that are probably mislabeled as main vocals or the reverse.",
		"Every line in the input is prefixed with a global marker like [line 12]. Use that number verbatim in your findings.",
		"syllableIndex is the 0-based index of the syllable inside that line; omit it for line-level findings.",
		"Do not repeat the local findings you are given unless you can add a concrete, different observation.",
		"Respond with ONLY a JSON array, no prose and no markdown fences. Use [] when nothing is wrong.",
		'Each item must look like: {"line": 12, "syllableIndex": 3, "severity": "error|warning|suggestion", "type": "timing|text|split|format", "message": "short explanation", "suggestedFix": "optional fix"}.',
	].join(" ");

	const user = [
		`Review lines ${chunk.startLine}-${chunk.endLine} of this TTML:`,
		"",
		chunk.text,
		"",
		"Local findings already detected (do not repeat them verbatim):",
		JSON.stringify(
			localIssues.map(({ line, syllableIndex, severity, type, message }) => ({
				line,
				syllableIndex,
				severity,
				type,
				message,
			})),
		),
	].join("\n");

	return [
		{ role: "system", content: system },
		{ role: "user", content: user },
	];
}

export class AiCheckParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AiCheckParseError";
	}
}

const stripCodeFences = (raw: string) =>
	raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "")
		.trim();

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const clampText = (value: unknown, limit: number): string | undefined =>
	typeof value === "string" && value.trim().length > 0
		? value.trim().slice(0, limit)
		: undefined;

/**
 * Validates a model response. Returns only well-formed findings and throws a
 * friendly error when the payload is not a JSON array at all.
 */
export function parseAiIssueResponse(
	raw: string,
	maxLine: number,
): AiCheckIssue[] {
	const clean = stripCodeFences(raw);
	const start = clean.indexOf("[");
	const end = clean.lastIndexOf("]");
	if (start === -1 || end === -1 || end < start) {
		throw new AiCheckParseError(
			"The AI response did not contain a JSON array of issues.",
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(clean.slice(start, end + 1));
	} catch {
		throw new AiCheckParseError(
			"The AI response was not valid JSON, so it was ignored.",
		);
	}
	if (!Array.isArray(parsed)) {
		throw new AiCheckParseError("The AI response was not a JSON array.");
	}

	const issues: AiCheckIssue[] = [];
	const seen = new Set<string>();
	parsed.forEach((entry, index) => {
		const record = asRecord(entry);
		if (!record) return;
		const line = Number(record.line);
		if (!Number.isInteger(line) || line < 1 || line > maxLine) return;
		const message = clampText(record.message, 400);
		if (!message) return;

		const severity: AiCheckSeverity =
			typeof record.severity === "string" &&
			(AI_CHECK_SEVERITIES as readonly string[]).includes(record.severity)
				? (record.severity as AiCheckSeverity)
				: "warning";
		const type: AiCheckIssueType =
			typeof record.type === "string" &&
			(AI_CHECK_ISSUE_TYPES as readonly string[]).includes(record.type)
				? (record.type as AiCheckIssueType)
				: "text";

		const rawIndex = Number(record.syllableIndex);
		const syllableIndex =
			Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < 500
				? rawIndex
				: undefined;

		const key = `${line}:${syllableIndex ?? "-"}:${type}:${message.toLowerCase()}`;
		if (seen.has(key)) return;
		seen.add(key);

		issues.push({
			id: `ai:${line}:${syllableIndex ?? "-"}:${index}`,
			line,
			syllableIndex,
			severity,
			type,
			message,
			suggestedFix: clampText(record.suggestedFix, 400),
			source: "ai",
		});
	});

	return issues;
}