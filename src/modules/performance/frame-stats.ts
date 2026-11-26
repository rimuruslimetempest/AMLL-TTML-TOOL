/**
 * Rolling frame statistics for the diagnostics overlay. It deliberately lives
 * outside React: the overlay reads a snapshot twice a second and draws it
 * straight into the DOM, so showing frame timings cannot itself cost frames.
 */

export const FRAME_STATS_WINDOW_MS = 5000;
const MAX_SAMPLES = 2000;
const MAX_SLOW_FRAMES = 50;
const SLOW_FRAME_MS = 20;

export interface SlowFrame {
	at: number;
	ms: number;
	label?: string;
}

export interface FrameStatsSnapshot {
	fps: number;
	averageMs: number;
	onePercentLowMs: number;
	onePercentLowFps: number;
	worstMs: number;
	overBudgetPercent: number;
	samples: number;
}

export const EMPTY_FRAME_STATS: FrameStatsSnapshot = {
	fps: 0,
	averageMs: 0,
	onePercentLowMs: 0,
	onePercentLowFps: 0,
	worstMs: 0,
	overBudgetPercent: 0,
	samples: 0,
};

export class FrameStats {
	private times: number[] = [];
	private stamps: number[] = [];
	private slow: SlowFrame[] = [];

	reset(): void {
		this.times = [];
		this.stamps = [];
		this.slow = [];
	}

	push(dtMs: number, now: number, label?: string): void {
		if (!Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 250) return;
		this.times.push(dtMs);
		this.stamps.push(now);

		while (
			this.times.length > MAX_SAMPLES ||
			(this.stamps[0] !== undefined &&
				this.stamps[0] < now - FRAME_STATS_WINDOW_MS)
		) {
			this.times.shift();
			this.stamps.shift();
		}

		if (dtMs >= SLOW_FRAME_MS) {
			this.slow.push({ at: now, ms: dtMs, label });
			if (this.slow.length > MAX_SLOW_FRAMES) this.slow.shift();
		}
	}

	snapshot(budgetMs = 16.7): FrameStatsSnapshot {
		const count = this.times.length;
		if (count === 0) return { ...EMPTY_FRAME_STATS };

		let total = 0;
		let over = 0;
		for (const time of this.times) {
			total += time;
			if (time > budgetMs) over += 1;
		}
		const average = total / count;
		const sorted = [...this.times].sort((a, b) => a - b);
		const onePercentCount = Math.max(1, Math.ceil(count * 0.01));
		let slowTotal = 0;
		for (let index = sorted.length - onePercentCount; index < sorted.length; index++)
			slowTotal += sorted[index] ?? 0;
		const onePercent = slowTotal / onePercentCount;

		return {
			fps: average > 0 ? 1000 / average : 0,
			averageMs: average,
			onePercentLowMs: onePercent,
			onePercentLowFps: onePercent > 0 ? 1000 / onePercent : 0,
			worstMs: sorted[sorted.length - 1] ?? 0,
			overBudgetPercent: (over / count) * 100,
			samples: count,
		};
	}

	/** Most recent frame times, oldest first, for the graph. */
	history(count: number): number[] {
		return this.times.slice(Math.max(0, this.times.length - count));
	}

	slowFrames(): SlowFrame[] {
		return [...this.slow];
	}
}

export const frameStats = new FrameStats();
