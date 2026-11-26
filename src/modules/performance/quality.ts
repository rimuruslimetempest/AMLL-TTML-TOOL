/**
 * Adaptive visual quality. It only ever changes decoration; audio, input,
 * timing and text layout are never delayed or skipped by this controller.
 */

export type QualityPreference = "auto" | "high" | "medium" | "low";

export const QUALITY_PREFERENCE_VALUES: QualityPreference[] = [
	"auto",
	"high",
	"medium",
	"low",
];

/**
 * Level meaning:
 *  0 full effects
 *  1 no text glow / shadow animation
 *  2 simplified animated backdrop
 *  3 flat backdrop and decoration (closest to Performance mode)
 */
export const MAX_QUALITY_LEVEL = 3;

/** The 60 FPS floor: frames slower than this are over budget. */
export const FRAME_BUDGET_MS = 16.7;
const DOWNGRADE_AFTER_MS = 1200;
const UPGRADE_AFTER_MS = 10000;
const OVER_BUDGET_EMA_MS = 17.2;
const COMFORTABLE_EMA_MS = 12;

export class QualityController {
	private ema = 0;
	private overMs = 0;
	private underMs = 0;
	private level = 0;
	private primed = false;

	reset(): void {
		this.ema = 0;
		this.overMs = 0;
		this.underMs = 0;
		this.level = 0;
		this.primed = false;
	}

	/** Feed one frame; returns the level that should be active now. */
	update(dtMs: number, maxLevel = MAX_QUALITY_LEVEL): number {
		if (!Number.isFinite(dtMs) || dtMs <= 0) return this.level;
		const ceiling = Math.max(0, Math.min(MAX_QUALITY_LEVEL, maxLevel));

		if (!this.primed) {
			this.ema = dtMs;
			this.primed = true;
		} else {
			this.ema = this.ema * 0.9 + dtMs * 0.1;
		}

		if (this.ema > OVER_BUDGET_EMA_MS) {
			this.overMs += dtMs;
			this.underMs = 0;
		} else if (this.ema < COMFORTABLE_EMA_MS) {
			this.underMs += dtMs;
			this.overMs = Math.max(0, this.overMs - dtMs * 0.5);
		} else {
			this.underMs = 0;
			this.overMs = Math.max(0, this.overMs - dtMs * 0.25);
		}

		if (this.overMs >= DOWNGRADE_AFTER_MS && this.level < ceiling) {
			this.level += 1;
			this.overMs = 0;
			this.underMs = 0;
		} else if (this.underMs >= UPGRADE_AFTER_MS && this.level > 0) {
			this.level -= 1;
			this.underMs = 0;
			this.overMs = 0;
		}

		// A preference change can lower the ceiling below the current level.
		if (this.level > ceiling) this.level = ceiling;
		return this.level;
	}

	get current(): number {
		return this.level;
	}

	get smoothedFrameMs(): number {
		return this.ema;
	}
}

/** Fixed levels for the explicit choices; `null` means "let Auto decide". */
export function fixedLevelForPreference(
	preference: QualityPreference,
): number | null {
	switch (preference) {
		case "high":
			return 0;
		case "medium":
			return 1;
		case "low":
			return 2;
		default:
			return null;
	}
}

export function maxLevelForPreference(preference: QualityPreference): number {
	return preference === "auto" ? MAX_QUALITY_LEVEL : (fixedLevelForPreference(preference) ?? 0);
}
