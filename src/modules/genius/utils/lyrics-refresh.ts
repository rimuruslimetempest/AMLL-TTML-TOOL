import type { SegmentationConfig } from "$/modules/segmentation/types";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";

const GENIUS_HEADER_LINE = /^\[[^\]]+\]$/;
const IGNORED_GENIUS_LINES = new Set(["embed", "you might also like"]);
const GAP_SCORE = 0.65;
/**
 * A low-confidence pair is worse than treating both lines as changed. This is
 * deliberately conservative: attaching a newly written line to an unrelated
 * old timestamp is much harder to notice and undo than an added/removed line.
 */
const MIN_PAIR_SIMILARITY = 0.32;

export type GeniusRefreshEntryStatus =
	| "unchanged"
	| "changed"
	| "added"
	| "removed";

export interface GeniusRefreshEntry {
	status: GeniusRefreshEntryStatus;
	oldIndex: number | null;
	newIndex: number | null;
	oldText: string;
	newText: string;
}

export interface GeniusRefreshPlan {
	entries: GeniusRefreshEntry[];
	newLines: string[];
	changedCount: number;
	unchangedCount: number;
	addedCount: number;
	removedCount: number;
}

export interface ApplyGeniusRefreshOptions {
	includeStructuralChanges: boolean;
	segmentationConfig: SegmentationConfig;
}

export interface ApplyGeniusRefreshResult {
	lyrics: TTMLLyric;
	changedCount: number;
	addedCount: number;
	removedCount: number;
}

const normalizeDisplayText = (text: string): string =>
	text
		.normalize("NFC")
		.replace(/\u00a0|\u200b/g, " ")
		.replace(/[ \t]+/g, " ")
		.trim();

const comparableText = (text: string): string =>
	text
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replace(/&/g, " and ")
		.replace(/\p{M}+/gu, "")
		.replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Genius and exported TTML append background vocals as trailing
 * parenthetical groups. They are compared separately from the main line so a
 * line that only gains or loses its background part is not reported as
 * rewritten.
 */
const TRAILING_PARENTHETICALS = /(?:\s*[(（][^()（）]*[)）])+\s*$/;

const stripTrailingParentheticals = (text: string): string =>
	normalizeDisplayText(text.replace(TRAILING_PARENTHETICALS, ""));

/** Returns the visible text of an existing lyric line. */
export const getGeniusRefreshLineText = (line: LyricLine): string =>
	normalizeDisplayText(line.words.map((word) => word.word).join(""));

/** Parse plain Genius lyrics, dropping section labels and embed chrome. */
export const extractGeniusLyricLines = (lyrics: string): string[] =>
	lyrics
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map(normalizeDisplayText)
		.filter((line) => {
			if (!line || GENIUS_HEADER_LINE.test(line)) return false;
			const lower = line.toLocaleLowerCase();
			return (
				!IGNORED_GENIUS_LINES.has(lower) &&
				!/^you might also like\b/i.test(line)
			);
		});

const characterGrams = (text: string): Set<string> => {
	const chars = Array.from(text);
	if (chars.length < 2) return new Set(chars);
	const grams = new Set<string>();
	for (let index = 0; index < chars.length - 1; index++) {
		grams.add(`${chars[index]}${chars[index + 1]}`);
	}
	return grams;
};

const textSimilarity = (left: string, right: string): number => {
	const leftComparable = comparableText(left);
	const rightComparable = comparableText(right);
	if (leftComparable === rightComparable) return 1;
	if (!leftComparable || !rightComparable) return 0;

	const leftGrams = characterGrams(leftComparable);
	const rightGrams = characterGrams(rightComparable);
	let intersection = 0;
	for (const gram of leftGrams) {
		if (rightGrams.has(gram)) intersection++;
	}
	return (2 * intersection) / (leftGrams.size + rightGrams.size);
};

interface AlignmentStep {
	status: GeniusRefreshEntryStatus;
	oldIndex: number | null;
	newIndex: number | null;
	oldText: string;
	newText: string;
}

const alignLyricLines = (
	oldLines: string[],
	newLines: string[],
	oldHasBackground: boolean[],
): AlignmentStep[] => {
	const rows = oldLines.length + 1;
	const columns = newLines.length + 1;
	const scores = Array.from({ length: rows }, () =>
		Array<number>(columns).fill(Number.NEGATIVE_INFINITY),
	);
	const moves = Array.from({ length: rows }, () =>
		Array<0 | 1 | 2 | 3>(columns).fill(0),
	);

	scores[0][0] = 0;
	for (let row = 1; row < rows; row++) {
		scores[row][0] = scores[row - 1][0] - GAP_SCORE;
		moves[row][0] = 2;
	}
	for (let column = 1; column < columns; column++) {
		scores[0][column] = scores[0][column - 1] - GAP_SCORE;
		moves[0][column] = 3;
	}

	for (let row = 1; row < rows; row++) {
		for (let column = 1; column < columns; column++) {
			const oldText = oldLines[row - 1];
			const newText = newLines[column - 1];
			const hasBackground = oldHasBackground[row - 1] === true;
			const oldComparable = hasBackground
				? stripTrailingParentheticals(oldText)
				: oldText;
			const newComparable = hasBackground
				? stripTrailingParentheticals(newText)
				: newText;
			const similarity = textSimilarity(oldComparable, newComparable);
			const matchScore =
				oldComparable.length > 0 &&
				newComparable.length > 0 &&
				similarity >= MIN_PAIR_SIMILARITY
					? similarity * 2 - 1
					: Number.NEGATIVE_INFINITY;
			const diagonal = scores[row - 1][column - 1] + matchScore;
			const remove = scores[row - 1][column] - GAP_SCORE;
			const add = scores[row][column - 1] - GAP_SCORE;

			if (diagonal >= remove && diagonal >= add) {
				scores[row][column] = diagonal;
				moves[row][column] = 1;
			} else if (remove >= add) {
				scores[row][column] = remove;
				moves[row][column] = 2;
			} else {
				scores[row][column] = add;
				moves[row][column] = 3;
			}
		}
	}

	const reversed: AlignmentStep[] = [];
	let row = oldLines.length;
	let column = newLines.length;
	while (row > 0 || column > 0) {
		const move = moves[row][column];
		if (row > 0 && column > 0 && move === 1) {
			const oldText = oldLines[row - 1];
			const newText = newLines[column - 1];
			const hasBackground = oldHasBackground[row - 1] === true;
			const oldComparable = hasBackground
				? stripTrailingParentheticals(oldText)
				: oldText;
			const newComparable = hasBackground
				? stripTrailingParentheticals(newText)
				: newText;
			reversed.push({
				status:
					textSimilarity(oldComparable, newComparable) === 1
						? "unchanged"
						: "changed",
				oldIndex: row - 1,
				newIndex: column - 1,
				oldText,
				newText,
			});
			row--;
			column--;
		} else if (row > 0 && (move === 2 || column === 0)) {
			reversed.push({
				status: "removed",
				oldIndex: row - 1,
				newIndex: null,
				oldText: oldLines[row - 1],
				newText: "",
			});
			row--;
		} else {
			reversed.push({
				status: "added",
				oldIndex: null,
				newIndex: column - 1,
				oldText: "",
				newText: newLines[column - 1],
			});
			column--;
		}
	}
	return reversed.reverse();
};

export const buildGeniusRefreshPlan = (
	lyrics: TTMLLyric,
	geniusLyrics: string,
): GeniusRefreshPlan => {
	const newLines = extractGeniusLyricLines(geniusLyrics);
	const oldLines: string[] = [];
	const oldIndices: number[] = [];
	const oldHasBackground: boolean[] = [];
	lyrics.lyricLines.forEach((line, index) => {
		if (line.isBG) return;
		oldLines.push(getGeniusRefreshLineText(line));
		oldIndices.push(index);
		oldHasBackground.push(Boolean(lyrics.lyricLines[index + 1]?.isBG));
	});
	const entries = alignLyricLines(oldLines, newLines, oldHasBackground);
	for (const entry of entries) {
		if (entry.oldIndex === null) continue;
		entry.oldIndex = oldIndices[entry.oldIndex] ?? null;
	}

	return {
		entries,
		newLines,
		changedCount: entries.filter((entry) => entry.status === "changed").length,
		unchangedCount: entries.filter((entry) => entry.status === "unchanged")
			.length,
		addedCount: entries.filter((entry) => entry.status === "added").length,
		removedCount: entries.filter((entry) => entry.status === "removed").length,
	};
};

const wordRange = (line: LyricLine): { start: number; end: number } => {
	const timedWords = line.words.filter(
		(word) => word.endTime > word.startTime || word.startTime > 0,
	);
	return {
		start: timedWords[0]?.startTime ?? line.startTime,
		end: timedWords[timedWords.length - 1]?.endTime ?? line.endTime,
	};
};

const splitLineWords = (
	text: string,
	line: LyricLine,
	segmentationConfig: SegmentationConfig,
): LyricWord[] => {
	const range = wordRange(line);
	const temporaryWord: LyricWord = {
		...newLyricWord(),
		word: text,
		startTime: range.start,
		endTime: range.end,
	};
	const temporaryLine: LyricLine = {
		...newLyricLine(),
		startTime: line.startTime,
		endTime: line.endTime,
		words: [temporaryWord],
	};
	const segmented = segmentLyricLines(
		[temporaryLine],
		segmentationConfig,
		true,
	)[0]?.words;
	return segmented?.filter((word) => word.word.length > 0) ?? [];
};

const buildRefreshedLineWords = (
	line: LyricLine,
	text: string,
	segmentationConfig: SegmentationConfig,
): LyricWord[] => {
	const oldWords = line.words;
	if (line.isLineSynced || line.ignoreSync || oldWords.length <= 1) {
		const source = oldWords[0];
		const hasLineRange = line.endTime > line.startTime;
		return [
			{
				...(source ?? newLyricWord()),
				word: text,
				romanWord: "",
				ruby: undefined,
				obscene: false,
				startTime: hasLineRange
					? line.startTime
					: (source?.startTime ?? line.startTime),
				endTime: hasLineRange
					? line.endTime
					: (source?.endTime ?? line.endTime),
			},
		];
	}

	const segmentedWords = splitLineWords(text, line, segmentationConfig);
	if (segmentedWords.length === 0) {
		const range = wordRange(line);
		return [
			{
				...newLyricWord(),
				word: text,
				startTime: range.start,
				endTime: range.end,
			},
		];
	}

	if (segmentedWords.length === oldWords.length) {
		return segmentedWords.map((word, index) => {
			const oldWord = oldWords[index];
			const textUnchanged =
				comparableText(oldWord.word) === comparableText(word.word);
			return {
				...oldWord,
				word: word.word,
				romanWord: textUnchanged ? oldWord.romanWord : "",
				ruby: textUnchanged ? oldWord.ruby : undefined,
				obscene: textUnchanged ? oldWord.obscene : false,
			};
		});
	}

	return segmentedWords.map((word) => ({
		...newLyricWord(),
		word: word.word,
		startTime: word.startTime,
		endTime: word.endTime,
	}));
};

const createAddedLineWords = (
	text: string,
	segmentationConfig: SegmentationConfig,
): LyricWord[] => {
	const temporaryLine: LyricLine = {
		...newLyricLine(),
		words: [
			{
				...newLyricWord(),
				word: text,
			},
		],
	};
	const segmented = segmentLyricLines(
		[temporaryLine],
		segmentationConfig,
		true,
	)[0]?.words;
	const words =
		segmented && segmented.length > 0
			? segmented
			: [{ ...newLyricWord(), word: text }];
	return words.map((word) => ({
		...newLyricWord(),
		word: word.word,
		startTime: 0,
		endTime: 0,
	}));
};

const createAddedLine = (
	text: string,
	previous: LyricLine | undefined,
	segmentationConfig: SegmentationConfig,
): LyricLine => {
	const line = newLyricLine();
	line.words = createAddedLineWords(text, segmentationConfig);
	line.startTime = 0;
	line.endTime = 0;
	if (previous) {
		line.sectionId = previous.sectionId;
		line.geniusHeader = previous.geniusHeader;
		line.agent = previous.agent;
		line.isDuet = previous.isDuet;
		line.language = previous.language;
	}
	return line;
};

const trailingBackgroundLines = (
	lines: LyricLine[],
	lineIndex: number,
): LyricLine[] => {
	const background: LyricLine[] = [];
	for (let index = lineIndex + 1; index < lines.length; index++) {
		const line = lines[index];
		if (!line.isBG) break;
		background.push(line);
	}
	return background;
};

export const applyGeniusRefreshPlan = (
	lyrics: TTMLLyric,
	plan: GeniusRefreshPlan,
	options: ApplyGeniusRefreshOptions,
): ApplyGeniusRefreshResult => {
	const sourceLines = lyrics.lyricLines;
	const nextLines: LyricLine[] = [];
	let changedCount = 0;
	let addedCount = 0;
	let removedCount = 0;

	let leadingBackground = 0;
	while (
		leadingBackground < sourceLines.length &&
		sourceLines[leadingBackground].isBG
	) {
		nextLines.push(sourceLines[leadingBackground]);
		leadingBackground++;
	}

	for (const entry of plan.entries) {
		if (entry.status === "removed") {
			if (options.includeStructuralChanges) {
				removedCount++;
				continue;
			}
			if (entry.oldIndex === null) continue;
			const oldLine = sourceLines[entry.oldIndex];
			if (!oldLine) continue;
			nextLines.push(
				oldLine,
				...trailingBackgroundLines(sourceLines, entry.oldIndex),
			);
			continue;
		}

		if (entry.status === "added") {
			if (!options.includeStructuralChanges) continue;
			addedCount++;
			nextLines.push(
				createAddedLine(
					entry.newText,
					nextLines[nextLines.length - 1],
					options.segmentationConfig,
				),
			);
			continue;
		}

		if (entry.oldIndex === null) continue;
		const oldLine = sourceLines[entry.oldIndex];
		if (!oldLine) continue;
		const backgroundLines = trailingBackgroundLines(
			sourceLines,
			entry.oldIndex,
		);
		if (entry.status === "unchanged") {
			nextLines.push(oldLine, ...backgroundLines);
			continue;
		}
		changedCount++;
		const nextText =
			backgroundLines.length > 0
				? stripTrailingParentheticals(entry.newText) || entry.newText
				: entry.newText;
		nextLines.push(
			{
				...oldLine,
				words: buildRefreshedLineWords(
					oldLine,
					nextText,
					options.segmentationConfig,
				),
			},
			...backgroundLines,
		);
	}

	return {
		lyrics: { ...lyrics, lyricLines: nextLines },
		changedCount,
		addedCount,
		removedCount,
	};
};
