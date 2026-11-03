import type { CueSound } from "$/modules/settings/states/cues";

interface PartialSpec {
	frequency: number;
	gain: number;
}

interface CueSoundSpec {
	duration: number;
	/** Exponential amplitude decay constant, in seconds. */
	decay: number;
	partials: PartialSpec[];
}

const SOUND_SPECS: Record<CueSound, CueSoundSpec> = {
	tick: {
		duration: 0.014,
		decay: 0.004,
		partials: [{ frequency: 1800, gain: 1 }],
	},
	click: {
		duration: 0.03,
		decay: 0.01,
		partials: [{ frequency: 1000, gain: 1 }],
	},
	beep: {
		duration: 0.08,
		decay: 0.05,
		partials: [{ frequency: 880, gain: 1 }],
	},
	woodblock: {
		duration: 0.05,
		decay: 0.012,
		partials: [
			{ frequency: 620, gain: 0.8 },
			{ frequency: 1240, gain: 0.6 },
		],
	},
};

const PEAK_AMPLITUDE = 0.9;
const FADE_IN_SECONDS = 0.002;
const FADE_OUT_SECONDS = 0.008;

const bufferCache = new WeakMap<BaseAudioContext, Map<CueSound, AudioBuffer>>();

/**
 * Builds a short click in code so cues need no assets and work offline.
 * Buffers are cached per context and reused by every source node.
 */
export function getCueBuffer(
	ctx: BaseAudioContext,
	sound: CueSound,
): AudioBuffer {
	let cachedBySound = bufferCache.get(ctx);
	if (!cachedBySound) {
		cachedBySound = new Map<CueSound, AudioBuffer>();
		bufferCache.set(ctx, cachedBySound);
	}
	const cached = cachedBySound.get(sound);
	if (cached) return cached;

	const spec = SOUND_SPECS[sound];
	const sampleRate = ctx.sampleRate;
	const length = Math.max(1, Math.round(spec.duration * sampleRate));
	const buffer = ctx.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);
	const fadeIn = Math.min(FADE_IN_SECONDS, spec.duration / 4);
	const fadeOut = Math.min(FADE_OUT_SECONDS, spec.duration / 3);
	// Normalise the partials so adding harmonics cannot push the click into
	// clipping as the peak amplitude rises.
	const totalGain =
		spec.partials.reduce((sum, partial) => sum + partial.gain, 0) || 1;

	for (let i = 0; i < length; i++) {
		const time = i / sampleRate;
		const attack = fadeIn > 0 ? Math.min(1, time / fadeIn) : 1;
		const release =
			fadeOut > 0
				? Math.max(0, Math.min(1, (spec.duration - time) / fadeOut))
				: 1;
		const envelope = Math.exp(-time / spec.decay) * attack * release;

		let sample = 0;
		for (const partial of spec.partials) {
			sample += Math.sin(2 * Math.PI * partial.frequency * time) * partial.gain;
		}
		data[i] = (sample / totalGain) * envelope * PEAK_AMPLITUDE;
	}

	cachedBySound.set(sound, buffer);
	return buffer;
}
