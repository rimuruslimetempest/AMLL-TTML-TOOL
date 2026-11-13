import { uid } from "uid";
import {
	applyLearnedRule,
	getLearnedWordParts,
} from "$/modules/segmentation/utils/learned-rules";
import type { LyricLine, LyricWord } from "$/types/ttml";
import {
	EMPTY_SPLIT_LIBRARY,
	type SavedSplitPattern,
	type SharedSplitSuggestion,
	type SplitLibraryFile,
	type SplitPatternPreview,
	type SplitSource,
} from "./types";

const MAX_PATTERNS = 10_000;
const MAX_NOTE = 500;
const MAX_LABEL = 80;

export function splitWordKey(text: string): string {
	return (
		getLearnedWordParts(text)?.key ??
		text.normalize("NFC").trim().toLowerCase()
	);
}

export function boundariesFromParts(text: string, parts: string[]): number[] {
	const core = getLearnedWordParts(text);
	if (!core) return [];
	const coreLength = core.coreEnd - core.coreStart;
	let cursor = 0;
	const boundaries: number[] = [];
	for (const part of parts.slice(0, -1)) {
		cursor += Array.from(part).length;
		if (cursor > 0 && cursor < coreLength) boundaries.push(cursor);
	}
	return [...new Set(boundaries)].sort((left, right) => left - right);
}

export function partsForPattern(
	displayWord: string,
	boundaries: number[],
): string[] {
	const core = getLearnedWordParts(displayWord);
	if (!core) return [displayWord];
	const chars = core.chars;
	const coreChars = chars.slice(core.coreStart, core.coreEnd);
	const valid = boundaries
		.filter((value) => Number.isInteger(value) && value > 0 && value < coreChars.length)
		.sort((left, right) => left - right);
	const parts: string[] = [];
	let start = 0;
	for (const end of valid) {
		parts.push(coreChars.slice(start, end).join(""));
		start = end;
	}
	parts.push(coreChars.slice(start).join(""));
	parts[0] = chars.slice(0, core.coreStart).join("") + parts[0];
	parts[parts.length - 1] += chars.slice(core.coreEnd).join("");
	return parts;
}

export function patternText(pattern: SavedSplitPattern): string {
	return partsForPattern(pattern.displayWord, pattern.boundaries).join(" / ");
}

export function patternName(pattern: SavedSplitPattern): string {
	return pattern.label.trim() || patternText(pattern);
}

export function buildPatternIndex(
	patterns: readonly SavedSplitPattern[],
): Map<string, SavedSplitPattern[]> {
	const index = new Map<string, SavedSplitPattern[]>();
	for (const pattern of patterns) {
		const list = index.get(pattern.wordKey);
		if (list) list.push(pattern);
		else index.set(pattern.wordKey, [pattern]);
	}
	for (const list of index.values()) {
		list.sort((left, right) => {
			if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
			return left.displayWord.localeCompare(right.displayWord);
		});
	}
	return index;
}

export function patternsForWord(
	index: ReadonlyMap<string, SavedSplitPattern[]>,
	text: string,
): SavedSplitPattern[] {
	return index.get(splitWordKey(text)) ?? [];
}

export function defaultPatternForWord(
	index: ReadonlyMap<string, SavedSplitPattern[]>,
	text: string,
): SavedSplitPattern | undefined {
	return patternsForWord(index, text)[0];
}

export function createSplitPattern(
	text: string,
	boundaries: number[],
	options: {
		label?: string;
		note?: string;
		isDefault?: boolean;
		id?: string;
		now?: number;
	} = {},
): SavedSplitPattern | null {
	const parts = getLearnedWordParts(text);
	if (!parts) return null;
	const coreLength = parts.coreEnd - parts.coreStart;
	const cleanBoundaries = [...new Set(boundaries)]
		.filter(
			(value) =>
				Number.isInteger(value) && value > 0 && value < coreLength,
		)
		.sort((left, right) => left - right);
	if (cleanBoundaries.length === 0) return null;
	const now = options.now ?? Date.now();
	return {
		id: options.id ?? uid(),
		wordKey: parts.key,
		displayWord: text,
		boundaries: cleanBoundaries,
		label: (options.label ?? "").trim().slice(0, MAX_LABEL),
		note: (options.note ?? "").trim().slice(0, MAX_NOTE),
		isDefault: options.isDefault ?? false,
		createdAt: now,
		updatedAt: now,
	};
}

export function savePatternToLibrary(
	library: SplitLibraryFile,
	pattern: SavedSplitPattern,
): SplitLibraryFile {
	const same = library.patterns.find(
		(candidate) =>
			candidate.wordKey === pattern.wordKey &&
			candidate.boundaries.join(",") === pattern.boundaries.join(","),
	);
	let nextPattern = pattern;
	let patterns = library.patterns;
	if (same) {
		nextPattern = {
			...same,
			displayWord: pattern.displayWord,
			label: pattern.label || same.label,
			note: pattern.note || same.note,
			updatedAt: pattern.updatedAt,
		};
		patterns = library.patterns.map((candidate) =>
			candidate.id === same.id ? nextPattern : candidate,
		);
	} else {
		patterns = [...library.patterns, pattern].slice(-MAX_PATTERNS);
	}
	if (nextPattern.isDefault) {
		patterns = patterns.map((candidate) =>
			candidate.wordKey === nextPattern.wordKey &&
			candidate.id !== nextPattern.id
				? { ...candidate, isDefault: false }
				: candidate,
		);
	}
	return { ...library, patterns };
}

export function makePatternDefault(
	library: SplitLibraryFile,
	patternId: string,
): SplitLibraryFile {
	const target = library.patterns.find((pattern) => pattern.id === patternId);
	if (!target) return library;
	return {
		...library,
		patterns: library.patterns.map((pattern) =>
			pattern.wordKey === target.wordKey
				? { ...pattern, isDefault: pattern.id === patternId, updatedAt: Date.now() }
				: pattern,
		),
	};
}

export function removePatternFromLibrary(
	library: SplitLibraryFile,
	patternId: string,
): SplitLibraryFile {
	const target = library.patterns.find((pattern) => pattern.id === patternId);
	const patterns = library.patterns.filter((pattern) => pattern.id !== patternId);
	if (target?.isDefault) {
		const replacement = patterns.find(
			(pattern) => pattern.wordKey === target.wordKey,
		);
		if (replacement) replacement.isDefault = true;
	}
	return { ...library, patterns };
}

/**
 * Applies a saved boundary pattern without changing the spelling of the token.
 * Timing is divided proportionally by the visible text length; already-timed
 * parts are marked for review.
 */
export function splitWordWithPattern(
	word: LyricWord,
	pattern: Pick<SavedSplitPattern, "boundaries" | "id" | "displayWord">,
	source: SplitSource = "library",
): LyricWord[] {
	const segments =
		applyLearnedRule(word.word, new Map([[splitWordKey(word.word), pattern.boundaries]])) ??
		partsForPattern(word.word, pattern.boundaries);
	if (segments.length <= 1) return [word];
	const hadTiming = word.endTime > word.startTime;
	const totalDuration = Math.max(0, word.endTime - word.startTime);
	const weights = segments.map((segment) => Math.max(1, Array.from(segment).length));
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
	let cursor = word.startTime;
	return segments.map((segment, index) => {
		const isLast = index === segments.length - 1;
		const duration = totalDuration
			? isLast
				? Math.max(0, word.endTime - cursor)
				: Math.round((weights[index] / totalWeight) * totalDuration)
			: 0;
		const next: LyricWord = {
			...word,
			id: uid(),
			word: segment,
			startTime: cursor,
			endTime: isLast ? word.endTime : cursor + duration,
			needsReview: hadTiming || word.needsReview ? true : undefined,
			splitSource: source,
			splitPatternId: pattern.id,
			romanWord: "",
			romanWarning: false,
			grammarWarning: false,
		};
		cursor = next.endTime;
		return next;
	});
}

export function buildSavedSplitPreview(
	lines: readonly LyricLine[],
	patterns: readonly SavedSplitPattern[],
	blockedLineIds: ReadonlySet<string> = new Set(),
): { previews: SplitPatternPreview[]; skipped: number } {
	const index = buildPatternIndex(patterns);
	const previews: SplitPatternPreview[] = [];
	let skipped = 0;
	let lineIndex = -1;
	for (const line of lines) {
		lineIndex += 1;
		if (blockedLineIds.has(line.id)) {
			skipped += line.words.length;
			continue;
		}
		let wordIndex = -1;
		for (const word of line.words) {
			wordIndex += 1;
			if (!word.word.trim() || word.word === " ") continue;
			const pattern = defaultPatternForWord(index, word.word);
			if (!pattern) continue;
			const next = splitWordWithPattern(word, pattern);
			if (next.length <= 1) continue;
			previews.push({
				lineId: line.id,
				lineIndex,
				wordId: word.id,
				wordIndex,
				lineText: line.words.map((entry) => entry.word).join(""),
				current: word.word,
				next: next.map((entry) => entry.word).join(" / "),
				patternId: pattern.id,
				patternLabel: patternName(pattern),
			});
		}
	}
	return { previews, skipped };
}

export function applySavedSplitPreview(
	lines: LyricLine[],
	previews: readonly SplitPatternPreview[],
	patterns: readonly SavedSplitPattern[],
): number {
	if (previews.length === 0) return 0;
	const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
	const previewByWordId = new Map(
		previews.map((preview) => [preview.wordId, preview] as const),
	);
	for (const line of lines) {
		line.words = line.words.flatMap((word) => {
			const preview = previewByWordId.get(word.id);
			const pattern = preview ? patternById.get(preview.patternId) : undefined;
			if (!preview || !pattern) return [word];
			return splitWordWithPattern(word, pattern, "library");
		});
	}
	return previews.length;
}

export function validateSplitLibraryFile(value: unknown): SplitLibraryFile {
	if (!value || typeof value !== "object") {
		throw new Error("This file does not contain a split library.");
	}
	const raw = value as Partial<SplitLibraryFile> & {
		patterns?: unknown;
		settings?: Partial<SplitLibraryFile["settings"]>;
	};
	if (raw.version !== undefined && raw.version !== 1) {
		throw new Error("This split library was made by a newer version.");
	}
	if (!Array.isArray(raw.patterns)) {
		throw new Error("The split library file is missing its patterns list.");
	}
	if (raw.patterns.length > MAX_PATTERNS) {
		throw new Error("This split library is too large to import.");
	}
	const seen = new Set<string>();
	const patterns: SavedSplitPattern[] = [];
	for (const [index, entry] of raw.patterns.entries()) {
		if (!entry || typeof entry !== "object") {
			throw new Error(`Pattern ${index + 1} is not an object.`);
		}
		const item = entry as Partial<SavedSplitPattern>;
		const displayWord =
			typeof item.displayWord === "string" ? item.displayWord.trim() : "";
		if (!displayWord) {
			throw new Error(`Pattern ${index + 1} is missing a word.`);
		}
		const boundaries = Array.isArray(item.boundaries)
			? item.boundaries.filter(
					(value): value is number =>
						typeof value === "number" && Number.isInteger(value),
				)
			: [];
		const built = createSplitPattern(displayWord, boundaries, {
			id: typeof item.id === "string" && item.id ? item.id : undefined,
			label: typeof item.label === "string" ? item.label : "",
			note: typeof item.note === "string" ? item.note : "",
			isDefault: item.isDefault === true,
			now:
				typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
					? item.createdAt
					: Date.now(),
		});
		if (!built) {
			throw new Error(
				`Pattern ${index + 1} for “${displayWord}” has no split points.`,
			);
		}
		const duplicateKey = `${built.wordKey}|${built.boundaries.join(",")}`;
		if (seen.has(duplicateKey)) continue;
		seen.add(duplicateKey);
		patterns.push(built);
	}
	const settings = {
		rememberSplits:
			typeof raw.settings?.rememberSplits === "boolean"
				? raw.settings.rememberSplits
				: EMPTY_SPLIT_LIBRARY.settings.rememberSplits,
		suggestSplits:
			typeof raw.settings?.suggestSplits === "boolean"
				? raw.settings.suggestSplits
				: EMPTY_SPLIT_LIBRARY.settings.suggestSplits,
	};
	return { version: 1, patterns, settings };
}

export function parseSplitLibraryJson(text: string): SplitLibraryFile {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error("That file is not valid JSON.");
	}
	return validateSplitLibraryFile(value);
}

export function serializeSplitLibrary(library: SplitLibraryFile): string {
	return JSON.stringify(
		{
			version: 1,
			exportedAt: new Date().toISOString(),
			settings: library.settings,
			patterns: library.patterns,
		},
		null,
		2,
	);
}

export function splitSourceLabel(source: SplitSource | undefined): string {
	switch (source) {
		case "library":
			return "From your split library";
		case "room":
			return "From a room suggestion";
		case "auto-segment":
			return "From Auto Segment";
		case "manual":
			return "Split by hand";
		default:
			return "Not split with a saved pattern";
	}
}

/** Converts a room suggestion into a personal library pattern. */
export function sharedSplitToPattern(
	suggestion: SharedSplitSuggestion,
): SavedSplitPattern | null {
	return createSplitPattern(suggestion.displayWord, suggestion.boundaries, {
		label: suggestion.label,
		note: suggestion.note,
	});
}
