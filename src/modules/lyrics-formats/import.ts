import { uid } from "uid";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import type { ParseResult } from "./parsers";

/**
 * Convert a parsed external lyric file into editor lines. Imported words are
 * always marked needsReview: the timing is a starting point, never trusted.
 */
export function parsedResultToTTML(result: ParseResult): TTMLLyric {
	const lyricLines: LyricLine[] = result.lines
		.filter((line) => line.text.trim())
		.map((line) => {
			const hasWords = (line.words?.length ?? 0) > 0;
			const words: LyricWord[] = hasWords
				? (line.words ?? []).map((word) => ({
						id: uid(),
						word: word.text,
						startTime: Math.max(line.startTime, word.startTime),
						endTime: Math.max(
							line.startTime,
							word.endTime > word.startTime
								? word.endTime
								: line.endTime,
						),
						obscene: false,
						romanWord: "",
						needsReview: true,
					}))
				: [
						{
							id: uid(),
							word: line.text,
							startTime: line.startTime,
							endTime: line.endTime,
							obscene: false,
							romanWord: "",
							needsReview: true,
						},
					];
			return {
				id: uid(),
				words,
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
				startTime: line.startTime,
				endTime: line.endTime,
				ignoreSync: false,
				isLineSynced: !hasWords,
				language: "auto",
			};
		});

	return { lyricLines, metadata: [] };
}
