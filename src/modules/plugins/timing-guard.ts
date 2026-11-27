import type { ToolLines } from "./types";

export interface ToolTimingSnapshot {
	lines: Array<{
		id: string;
		startTime: number;
		endTime: number;
		keys: string[];
		words: Array<{
			id: string;
			startTime: number;
			endTime: number;
			keys: string[];
		}>;
	}>;
}

/** The keys that survive JSON serialization, which is what a plugin receives. */
function presentKeys(value: object): string[] {
	return Object.keys(value)
		.filter((key) => (value as Record<string, unknown>)[key] !== undefined)
		.sort();
}

function sameKeys(value: object, expected: string[]): boolean {
	const keys = presentKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key, index) => key === expected[index])
	);
}

const RULE =
	"Tool plugins may edit lyric text only. Timing, line order, and word order stay under the editor's control.";

function reject(detail: string): never {
	throw new Error(`${RULE} ${detail}`);
}

/** Records the timing and identity the host expects a tool to leave untouched. */
export function snapshotToolTiming(lines: ToolLines): ToolTimingSnapshot {
	return {
		lines: lines.map((line) => ({
			id: line.id,
			startTime: line.startTime,
			endTime: line.endTime,
			keys: presentKeys(line),
			words: line.words.map((word) => ({
				id: word.id,
				startTime: word.startTime,
				endTime: word.endTime,
				keys: presentKeys(word),
			})),
		})),
	};
}

/**
 * Tool plugins receive the lyric lines as JSON. A malformed or overly broad
 * plugin could return different timestamps or a different structure, which
 * would silently retime the song. The host rejects that result instead of
 * applying it, so the "all timing is manual" rule also holds for plugins.
 */
export function assertToolTimingUnchanged(
	snapshot: ToolTimingSnapshot,
	result: ToolLines,
): ToolLines {
	if (!Array.isArray(result)) {
		reject("The plugin did not return a list of lyric lines.");
	}
	if (result.length !== snapshot.lines.length) {
		reject(
			`The line count changed from ${snapshot.lines.length} to ${result.length}.`,
		);
	}
	result.forEach((line, lineIndex) => {
		if (!line || typeof line !== "object" || !Array.isArray(line.words)) {
			reject(`Line ${lineIndex + 1} is not a lyric line.`);
		}
		const expectedLine = snapshot.lines[lineIndex];
		if (!expectedLine) {
			reject(`Line ${lineIndex + 1} was not in the original document.`);
		}
		if (line.id !== expectedLine.id) {
			reject(`Line ${lineIndex + 1} changed identity.`);
		}
		if (!sameKeys(line, expectedLine.keys)) {
			reject(`Line ${lineIndex + 1} added or removed fields.`);
		}
		if (
			line.startTime !== expectedLine.startTime ||
			line.endTime !== expectedLine.endTime
		) {
			reject(`Line ${lineIndex + 1} changed its start or end time.`);
		}
		if (line.words.length !== expectedLine.words.length) {
			reject(`Line ${lineIndex + 1} changed its word count.`);
		}
		line.words.forEach((word, wordIndex) => {
			if (!word || typeof word !== "object") {
				reject(`Line ${lineIndex + 1}, word ${wordIndex + 1} is not a word.`);
			}
			const expectedWord = expectedLine.words[wordIndex];
			if (!expectedWord) {
				reject(
					`Line ${lineIndex + 1}, word ${wordIndex + 1} was not in the original line.`,
				);
			}
			if (word.id !== expectedWord.id) {
				reject(
					`Line ${lineIndex + 1}, word ${wordIndex + 1} changed identity.`,
				);
			}
			if (!sameKeys(word, expectedWord.keys)) {
				reject(
					`Line ${lineIndex + 1}, word ${wordIndex + 1} added or removed fields.`,
				);
			}
			if (
				word.startTime !== expectedWord.startTime ||
				word.endTime !== expectedWord.endTime
			) {
				reject(
					`Line ${lineIndex + 1}, word ${wordIndex + 1} changed its start or end time.`,
				);
			}
		});
	});
	return result;
}
