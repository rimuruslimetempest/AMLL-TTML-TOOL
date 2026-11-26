/**
 * A small smoothing layer between the audio engine's reported playhead and the
 * animation loop. The engine time is authoritative but arrives with a little
 * jitter; feeding that straight into lyrics makes words twitch. The clock
 * follows the audio time loosely and snaps only when the two disagree enough
 * that a seek or a stall must have happened.
 */

/** Beyond this much disagreement the clock snaps instead of easing. */
export const AUDIO_CLOCK_MAX_DRIFT_MS = 40;

export class SmoothAudioClock {
	private value = 0;
	private lastNow = 0;
	private lastValue = 0;
	private playing = false;
	private initialized = false;

	reset(): void {
		this.value = 0;
		this.lastNow = 0;
		this.lastValue = 0;
		this.playing = false;
		this.initialized = false;
	}

	/**
	 * @param rawMs  the engine's current position in milliseconds
	 * @param nowMs  the frame timestamp
	 * @param playing whether audio is currently running
	 * @param rate    playback rate, so speed changes stay smooth
	 */
	update(
		rawMs: number,
		nowMs: number,
		playing: boolean,
		rate = 1,
	): number {
		if (!Number.isFinite(rawMs)) return this.value;
		const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;

		if (!this.initialized || !playing || !this.playing) {
			// Paused, starting, or resuming: the engine value is the truth and
			// there is no in-flight motion to ease.
			this.value = rawMs;
		} else {
			const elapsed = Math.max(0, nowMs - this.lastNow) * safeRate;
			const predicted = this.value + elapsed;
			const drift = rawMs - predicted;
			if (Math.abs(drift) > AUDIO_CLOCK_MAX_DRIFT_MS) {
				// A seek, a sample-rate change, or a long stall. Jump.
				this.value = rawMs;
			} else {
				// Correct a fifth of the error per frame and never step back.
				this.value = Math.max(this.lastValue, predicted + drift * 0.2);
			}
		}

		this.lastValue = this.value;
		this.lastNow = nowMs;
		this.playing = playing;
		this.initialized = true;
		return this.value;
	}

	get current(): number {
		return this.value;
	}
}
