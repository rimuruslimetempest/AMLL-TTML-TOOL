import { audioEngine } from "$/modules/audio/audio-engine";

export type PreviewFrame = {
	/** Smoothed visual playhead, in milliseconds. */
	timeMs: number;
	/** RAF timestamp for this frame. */
	now: number;
	/** Seconds since the previous frame, clamped for animation stability. */
	dt: number;
	playing: boolean;
};

type Subscriber = (frame: PreviewFrame) => void;

const subscribers = new Set<Subscriber>();
let raf = 0;
let bound = false;
let lastNow = 0;
let lastAudioMs = 0;
let lastAudioAt = 0;
let outputMs = 0;
let wasPlaying = false;
let seekVersion = 0;
let observedSeek = 0;

const DRIFT_LIMIT_MS = 45;

const audioTimeMs = () =>
	Math.max(0, Number(audioEngine.musicCurrentTime) * 1000 || 0);

const resetClock = (audioMs: number, now: number) => {
	lastAudioMs = audioMs;
	lastAudioAt = now;
	outputMs = audioMs;
	wasPlaying = true;
};

/**
 * The audio element/context exposes a stable but sometimes coarse time. While
 * playing we extrapolate from the last audio sample with performance.now();
 * only a real drift or a seek is allowed to correct the visual clock.
 */
const readFrame = (now: number): PreviewFrame => {
	const audioMs = audioTimeMs();
	const playing = audioEngine.musicPlaying;
	const dt =
		lastNow > 0
			? Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000))
			: 1 / 60;
	lastNow = now;

	if (!playing) {
		lastAudioMs = audioMs;
		lastAudioAt = now;
		outputMs = audioMs;
		wasPlaying = false;
		observedSeek = seekVersion;
		return { timeMs: audioMs, now, dt, playing: false };
	}

	if (!wasPlaying || observedSeek !== seekVersion) {
		observedSeek = seekVersion;
		resetClock(audioMs, now);
		return { timeMs: audioMs, now, dt, playing: true };
	}

	const rate = Math.max(
		0.25,
		Math.min(4, Number(audioEngine.musicPlayBackRate) || 1),
	);
	let estimate = lastAudioMs + (now - lastAudioAt) * rate;

	if (Math.abs(estimate - audioMs) > DRIFT_LIMIT_MS) {
		// A real correction. Keep it forward-only during normal playback so a
		// small scheduling hiccup cannot make the lyrics visibly rewind.
		lastAudioMs = audioMs;
		lastAudioAt = now;
		estimate = Math.max(outputMs, audioMs);
	}

	outputMs = Math.max(outputMs, estimate);
	return { timeMs: outputMs, now, dt, playing: true };
};

const emit = (now: number) => {
	if (!subscribers.size) return;
	const frame = readFrame(now);
	for (const subscriber of [...subscribers]) subscriber(frame);
};

const schedule = () => {
	if (raf || !subscribers.size || !audioEngine.musicPlaying || document.hidden)
		return;
	raf = requestAnimationFrame(loop);
};

const loop = (now: number) => {
	raf = 0;
	if (!subscribers.size) return;
	emit(now);
	if (audioEngine.musicPlaying && !document.hidden && subscribers.size)
		raf = requestAnimationFrame(loop);
};

const bind = () => {
	if (bound) return;
	bound = true;

	const onResume = () => {
		lastAudioMs = audioTimeMs();
		lastAudioAt = performance.now();
		outputMs = lastAudioMs;
		wasPlaying = true;
		emit(performance.now());
		schedule();
	};
	const onPause = () => {
		wasPlaying = false;
		emit(performance.now());
	};
	const onSeek = () => {
		seekVersion++;
		lastAudioMs = audioTimeMs();
		lastAudioAt = performance.now();
		outputMs = lastAudioMs;
		wasPlaying = audioEngine.musicPlaying;
		emit(performance.now());
		schedule();
	};
	const onVisibility = () => {
		if (document.hidden) {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		} else if (audioEngine.musicPlaying) {
			emit(performance.now());
			schedule();
		}
	};

	audioEngine.addEventListener("music-resume", onResume);
	audioEngine.addEventListener("music-pause", onPause);
	audioEngine.addEventListener("music-seeked", onSeek);
	document.addEventListener("visibilitychange", onVisibility);
};

export const subscribePreviewClock = (subscriber: Subscriber) => {
	subscribers.add(subscriber);
	bind();
	subscriber(readFrame(performance.now()));
	schedule();
	return () => {
		subscribers.delete(subscriber);
		if (!subscribers.size && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	};
};

/** One immediate paint after a setting change or a paused seek. */
export const requestPreviewFrame = () => {
	if (!subscribers.size) return;
	emit(performance.now());
	if (audioEngine.musicPlaying) schedule();
};
