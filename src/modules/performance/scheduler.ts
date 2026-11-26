/**
 * One animation loop for the whole app.
 *
 * Before this module the Preview renderer, its progress bar, the bottom
 * waveform and the spectrogram each owned a requestAnimationFrame loop. They
 * all read the same audio engine and the same clock, so they now share one
 * callback that stops as soon as nothing is subscribed.
 */
import { audioEngine } from "$/modules/audio/audio-engine";
import { SmoothAudioClock } from "./audio-clock";
import { frameStats } from "./frame-stats";
import { estimateRefreshRate } from "./refresh-rate";

export interface FrameInfo {
	/** requestAnimationFrame timestamp. */
	now: number;
	/** Milliseconds since the previous frame, clamped to a sane range. */
	dt: number;
	/** Smoothed song position in milliseconds (sampled once for every loop). */
	timeMs: number;
	playing: boolean;
	rate: number;
}

export interface FrameSubscriptionOptions {
	/** Read the audio clock for this subscriber. One sample is shared by all. */
	audio?: boolean;
	/** Name used to label slow frames in the diagnostics report. */
	label?: string;
}

type FrameListener = (frame: FrameInfo) => void;

interface SubscriptionMeta {
	audio: boolean;
	label?: string;
}

class FrameScheduler {
	private listeners = new Map<FrameListener, SubscriptionMeta>();
	private audioSubscribers = 0;
	private refreshListeners = new Set<(hz: number) => void>();
	private raf = 0;
	private lastNow = 0;
	private deltas: number[] = [];
	private framesSinceRateCheck = 0;
	private refreshRate = 60;
	private clock = new SmoothAudioClock();
	private forceAudioSample = true;
	private lastPausedSample = 0;
	private frame: FrameInfo = {
		now: 0,
		dt: 1000 / 60,
		timeMs: 0,
		playing: false,
		rate: 1,
	};

	get hz(): number {
		return this.refreshRate;
	}

	/** The display's own frame budget in milliseconds. */
	get budgetMs(): number {
		return 1000 / this.refreshRate;
	}

	subscribe(
		listener: FrameListener,
		options: FrameSubscriptionOptions = {},
	): () => void {
		if (this.listeners.size === 0) this.start();
		const meta: SubscriptionMeta = {
			audio: options.audio === true,
			label: options.label,
		};
		this.listeners.set(listener, meta);
		if (meta.audio) this.audioSubscribers += 1;
		return () => {
			const existing = this.listeners.get(listener);
			if (!existing) return;
			if (existing.audio) this.audioSubscribers -= 1;
			this.listeners.delete(listener);
			if (this.listeners.size === 0) this.stop();
		};
	}

	onRefreshRateChange(listener: (hz: number) => void): () => void {
		this.refreshListeners.add(listener);
		listener(this.refreshRate);
		return () => {
			this.refreshListeners.delete(listener);
		};
	}

	private setRefreshRate(hz: number): void {
		if (hz === this.refreshRate) return;
		this.refreshRate = hz;
		for (const listener of this.refreshListeners) listener(hz);
	}

	private start(): void {
		if (this.raf !== 0) return;
		this.lastNow = 0;
		this.deltas = [];
		this.framesSinceRateCheck = 0;
		this.clock.reset();
		if (typeof window !== "undefined") {
			window.addEventListener("resize", this.handleResize);
			document.addEventListener("visibilitychange", this.handleVisibility);
		}
		audioEngine.addEventListener("music-seeked", this.handleAudioJump);
		audioEngine.addEventListener("music-pause", this.handleAudioJump);
		audioEngine.addEventListener("music-resume", this.handleAudioJump);
		this.forceAudioSample = true;
		this.raf = requestAnimationFrame(this.tick);
	}

	private stop(): void {
		if (this.raf !== 0) cancelAnimationFrame(this.raf);
		this.raf = 0;
		this.lastNow = 0;
		this.clock.reset();
		if (typeof window !== "undefined") {
			window.removeEventListener("resize", this.handleResize);
			document.removeEventListener("visibilitychange", this.handleVisibility);
		}
		audioEngine.removeEventListener("music-seeked", this.handleAudioJump);
		audioEngine.removeEventListener("music-pause", this.handleAudioJump);
		audioEngine.removeEventListener("music-resume", this.handleAudioJump);
	}

	// A resize can move the window to another display, and a hidden tab stops
	// receiving frames; both invalidate the measured refresh rate.
	private handleResize = (): void => {
		this.deltas = [];
		this.framesSinceRateCheck = 0;
	};

	private handleAudioJump = (): void => {
		this.forceAudioSample = true;
	};

	private handleVisibility = (): void => {
		if (document.visibilityState === "visible") {
			this.deltas = [];
			this.framesSinceRateCheck = 0;
			this.lastNow = 0;
		}
	};

	private measureRefreshRate(dt: number): void {
		if (dt > 1 && dt < 60) {
			this.deltas.push(dt);
			if (this.deltas.length > 90) this.deltas.shift();
			this.framesSinceRateCheck += 1;
		}
		if (this.framesSinceRateCheck >= 30) {
			this.framesSinceRateCheck = 0;
			this.setRefreshRate(estimateRefreshRate(this.deltas));
		}
	}

	private tick = (now: number): void => {
		if (this.listeners.size === 0) {
			this.raf = 0;
			return;
		}
		this.raf = requestAnimationFrame(this.tick);

		const dt =
			this.lastNow > 0
				? Math.min(250, Math.max(0, now - this.lastNow))
				: 1000 / this.refreshRate;
		this.lastNow = now;
		this.measureRefreshRate(dt);

		const playing = audioEngine.musicPlaying;
		const rate = audioEngine.musicPlayBackRate;
		this.frame.now = now;
		this.frame.dt = dt;
		this.frame.playing = playing;
		this.frame.rate = rate;
		if (this.audioSubscribers > 0) {
			// One engine read per frame, shared by every subscriber. While paused
			// the position is static, so poll it a few times a second instead of
			// at display rate; seeks and play/pause force a fresh sample.
			if (
				playing ||
				this.forceAudioSample ||
				now - this.lastPausedSample >= 250
			) {
				this.frame.timeMs = this.clock.update(
					audioEngine.musicCurrentTime * 1000,
					now,
					playing,
					rate,
				);
				this.forceAudioSample = false;
				this.lastPausedSample = now;
			}
		}

		let slowestLabel: string | undefined;
		let slowestWork = 0;
		for (const [listener, meta] of this.listeners) {
			const startedAt = performance.now();
			try {
				listener(this.frame);
			} catch (error) {
				console.error("Frame subscriber failed", error);
			}
			if (meta.label) {
				const worked = performance.now() - startedAt;
				if (worked > slowestWork) {
					slowestWork = worked;
					slowestLabel = meta.label;
				}
			}
		}

		frameStats.push(dt, now, slowestLabel);
	};
}

export const frameScheduler = new FrameScheduler();
