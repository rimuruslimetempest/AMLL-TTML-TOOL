import type { CueEvent } from "./cue-sources";

export interface CueClock {
	/** Audible position in the song, in milliseconds. */
	timelineMs: number;
	/** Current render context time, in seconds. */
	contextTime: number;
	rate: number;
	playing: boolean;
}

export const CUE_LOOKAHEAD_SECONDS = 0.15;
const LATE_TOLERANCE_SECONDS = 0.05;
const MIN_LEAD_SECONDS = 0.005;

/** First index whose cue is at or after `timeMs`. */
export function lowerBoundTime(cues: CueEvent[], timeMs: number): number {
	let low = 0;
	let high = cues.length;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (cues[mid].timeMs < timeMs) low = mid + 1;
		else high = mid;
	}
	return low;
}

/**
 * Walks a sorted cue list with the playhead and schedules each cue once.
 * Pure bookkeeping: the caller maps song time to context time and plays the
 * sound. Any seek, pause, rate change or cue-list change must call
 * {@link rearm} after cancelling pending sounds.
 */
export class CueScheduler {
	private cues: CueEvent[] = [];
	private cursor = 0;
	private readonly lookaheadSeconds: number;

	constructor(lookaheadSeconds = CUE_LOOKAHEAD_SECONDS) {
		this.lookaheadSeconds = lookaheadSeconds;
	}

	setCues(cues: CueEvent[]) {
		this.cues = cues;
	}

	rearm(timelineMs: number) {
		const from = Number.isFinite(timelineMs) ? timelineMs : 0;
		this.cursor = lowerBoundTime(this.cues, from);
	}

	tick(
		clock: CueClock,
		mapTime: (timelineSeconds: number) => number | null,
		schedule: (cue: CueEvent, contextTime: number) => void,
	) {
		if (!clock.playing) return;
		const rate = Math.max(0.01, clock.rate || 1);
		const horizonMs = clock.timelineMs + this.lookaheadSeconds * 1000 * rate;

		while (this.cursor < this.cues.length) {
			const cue = this.cues[this.cursor];
			if (cue.timeMs > horizonMs) break;
			this.cursor++;

			// Already behind the audible playhead: never fire a late burst.
			if (cue.timeMs <= clock.timelineMs) continue;

			const contextTime = mapTime(cue.timeMs / 1000);
			if (contextTime === null) continue;
			if (contextTime < clock.contextTime - LATE_TOLERANCE_SECONDS) continue;

			schedule(
				cue,
				Math.max(contextTime, clock.contextTime + MIN_LEAD_SECONDS),
			);
		}
	}
}
