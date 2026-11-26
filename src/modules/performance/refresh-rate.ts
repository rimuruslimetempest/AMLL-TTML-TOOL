/**
 * Refresh-rate estimation from frame deltas. Kept free of runtime imports so
 * the maths can be unit tested without starting the audio engine.
 */

const COMMON_REFRESH_RATES = [
	24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240, 360,
];

/**
 * Turn a few dozen frame deltas into a refresh rate. Common rates win when the
 * measurement is close, so a 165 Hz panel reads as 165 rather than 164 or 166.
 */
export function estimateRefreshRate(deltas: number[]): number {
	const usable = deltas
		.filter((delta) => delta >= 1 && delta <= 60)
		.sort((a, b) => a - b);
	if (usable.length === 0) return 60;
	const median = usable[Math.floor(usable.length / 2)];
	if (!median) return 60;
	const measured = 1000 / median;
	for (const rate of COMMON_REFRESH_RATES) {
		if (Math.abs(measured - rate) / rate < 0.05) return rate;
	}
	return Math.max(24, Math.min(480, Math.round(measured)));
}
