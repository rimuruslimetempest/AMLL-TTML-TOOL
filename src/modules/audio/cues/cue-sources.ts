import type { CueSource } from "$/modules/settings/states/cues";
import type { LyricLine, TTMLLyric } from "$/types/ttml";

export interface CueEvent {
	id: string;
	timeMs: number;
	kind: CueSource;
	label?: string;
}

const KIND_PRIORITY: Record<CueSource, number> = {
	marks: 3,
	sections: 2,
	lines: 1,
	words: 0,
};

/** Line start, falling back to its first timed word. */
const effectiveLineStart = (line: LyricLine): number => {
	if (line.startTime > 0) return line.startTime;
	const firstWord = line.words?.find((word) => word.startTime > 0);
	return firstWord?.startTime ?? 0;
};

const isValidTime = (timeMs: number) => Number.isFinite(timeMs) && timeMs >= 0;

/** True when two cue lists would play the same clicks in the same order. */
export function cueListsEqual(a: CueEvent[], b: CueEvent[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i].id !== b[i].id || a[i].timeMs !== b[i].timeMs) return false;
	}
	return true;
}

/**
 * Turns the selected sources into one sorted, de-duplicated cue list.
 * Cues closer together than `minGapMs` collapse onto the higher-priority
 * source (mark > section > line > word) so dense lyrics do not buzz.
 */
export function collectCues(
	lyric: TTMLLyric,
	sources: Iterable<CueSource>,
	minGapMs = 60,
): CueEvent[] {
	const enabled = new Set<CueSource>(sources);
	const cues: CueEvent[] = [];

	if (enabled.has("marks")) {
		for (const mark of lyric.marks ?? []) {
			if (!isValidTime(mark.timeMs)) continue;
			cues.push({
				id: `mark:${mark.timeMs}`,
				timeMs: mark.timeMs,
				kind: "marks",
				label: mark.label,
			});
		}
	}

	if (enabled.has("sections")) {
		const sectionLabels = new Map(
			(lyric.sections ?? []).map((section) => [section.id, section.label]),
		);
		const lines = lyric.lyricLines;
		let index = 0;
		while (index < lines.length) {
			const sectionId = lines[index].sectionId;
			let end = index;
			while (end < lines.length && lines[end].sectionId === sectionId) end++;
			if (sectionId) {
				const timedLine = lines
					.slice(index, end)
					.find((line) => effectiveLineStart(line) > 0);
				if (timedLine) {
					const timeMs = effectiveLineStart(timedLine);
					cues.push({
						id: `section:${timeMs}:${sectionId}`,
						timeMs,
						kind: "sections",
						label: sectionLabels.get(sectionId),
					});
				}
			}
			index = end;
		}
	}

	if (enabled.has("lines")) {
		for (const line of lyric.lyricLines) {
			const timeMs = effectiveLineStart(line);
			if (timeMs <= 0) continue;
			cues.push({
				id: `line:${timeMs}`,
				timeMs,
				kind: "lines",
			});
		}
	}

	if (enabled.has("words")) {
		for (const line of lyric.lyricLines) {
			for (const word of line.words ?? []) {
				if (word.startTime <= 0) continue;
				cues.push({
					id: `word:${word.startTime}`,
					timeMs: word.startTime,
					kind: "words",
				});
			}
		}
	}

	cues.sort(
		(a, b) =>
			a.timeMs - b.timeMs || KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind],
	);

	const minGap = Math.max(0, minGapMs);
	const result: CueEvent[] = [];
	for (const cue of cues) {
		const previous = result[result.length - 1];
		if (
			previous &&
			(cue.timeMs === previous.timeMs || cue.timeMs - previous.timeMs < minGap)
		) {
			if (KIND_PRIORITY[cue.kind] > KIND_PRIORITY[previous.kind]) {
				result[result.length - 1] = cue;
			}
			continue;
		}
		result.push(cue);
	}
	return result;
}
