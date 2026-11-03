import { describe, expect, it } from "vitest";
import { CUE_SOUNDS, type CueSound } from "$/modules/settings/states/cues";
import { getCueBuffer } from "./cue-sounds";

/** Minimal stand-in for the Web Audio buffer API used by the synth. */
const makeContext = () => {
	const channels: Float32Array[] = [];
	const ctx = {
		sampleRate: 48000,
		createBuffer: (count: number, length: number, sampleRate: number) => {
			const data = new Float32Array(length);
			channels.push(data);
			return {
				numberOfChannels: count,
				length,
				sampleRate,
				duration: length / sampleRate,
				getChannelData: () => data,
			};
		},
	};
	return { ctx: ctx as unknown as BaseAudioContext, channels };
};

const peakOf = (data: Float32Array) => {
	let peak = 0;
	for (const sample of data) peak = Math.max(peak, Math.abs(sample));
	return peak;
};

describe("getCueBuffer", () => {
	it("renders every cue sound loud enough to hear but below clipping", () => {
		for (const sound of CUE_SOUNDS) {
			const { ctx, channels } = makeContext();
			getCueBuffer(ctx, sound);
			const peak = peakOf(channels[0]);
			expect(peak, sound).toBeGreaterThan(0.45);
			expect(peak, sound).toBeLessThan(0.95);
		}
	});

	it("decays to silence so consecutive cues do not overlap", () => {
		for (const sound of CUE_SOUNDS) {
			const { ctx, channels } = makeContext();
			getCueBuffer(ctx, sound);
			const data = channels[0];
			expect(Math.abs(data[data.length - 1]), sound).toBeLessThan(0.02);
			expect(peakOf(data), sound).toBeGreaterThan(0.45);
		}
	});

	it("gives each sound its own duration", () => {
		const durationOf = (sound: CueSound) => {
			const { ctx, channels } = makeContext();
			getCueBuffer(ctx, sound);
			return channels[0].length / ctx.sampleRate;
		};
		expect(durationOf("tick")).toBeLessThan(durationOf("click"));
		expect(durationOf("click")).toBeLessThan(durationOf("beep"));
	});

	it("caches one buffer per sound and context", () => {
		const { ctx } = makeContext();
		expect(getCueBuffer(ctx, "click")).toBe(getCueBuffer(ctx, "click"));
		expect(getCueBuffer(ctx, "click")).not.toBe(getCueBuffer(ctx, "beep"));
	});
});