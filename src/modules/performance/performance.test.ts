import { describe, expect, it } from "vitest";
import { SmoothAudioClock } from "./audio-clock";
import { FrameStats } from "./frame-stats";
import { QualityController } from "./quality";
import { estimateRefreshRate } from "./refresh-rate";

describe("estimateRefreshRate", () => {
	it("recognises common display rates from measured deltas", () => {
		expect(estimateRefreshRate(Array(60).fill(16.667))).toBe(60);
		expect(estimateRefreshRate(Array(60).fill(6.06))).toBe(165);
		expect(estimateRefreshRate(Array(60).fill(4.167))).toBe(240);
		expect(estimateRefreshRate(Array(60).fill(2.778))).toBe(360);
	});

	it("falls back to a measured value for unusual panels", () => {
		expect(estimateRefreshRate(Array(40).fill(7.5))).toBe(133);
		expect(estimateRefreshRate([])).toBe(60);
	});
});

describe("SmoothAudioClock", () => {
	it("uses the engine value while paused and when playback starts", () => {
		const clock = new SmoothAudioClock();
		expect(clock.update(1000, 0, false)).toBe(1000);
		expect(clock.update(1016, 16, true)).toBe(1016);
	});

	it("eases small drift instead of copying it", () => {
		const clock = new SmoothAudioClock();
		clock.update(2000, 0, true);
		const next = clock.update(2030, 16, true);
		expect(next).toBeGreaterThan(2016);
		expect(next).toBeLessThan(2030);
	});

	it("snaps forward and backward when the drift is a seek", () => {
		const clock = new SmoothAudioClock();
		clock.update(2000, 0, true);
		expect(clock.update(2100, 16, true)).toBe(2100);
		expect(clock.update(1900, 32, true)).toBe(1900);
	});

	it("never steps backwards while merely smoothing", () => {
		const clock = new SmoothAudioClock();
		clock.update(2000, 0, true);
		clock.update(2016, 16, true);
		const stable = clock.update(2016, 32, true);
		expect(stable).toBeGreaterThanOrEqual(2016);
		expect(stable).toBeLessThan(2032);
	});

	it("respects playback rate when predicting", () => {
		const clock = new SmoothAudioClock();
		clock.update(1000, 0, true, 1.5);
		const next = clock.update(1024, 16, true, 1.5);
		expect(next).toBeGreaterThan(1023);
		expect(next).toBeLessThanOrEqual(1024);
	});
});

describe("FrameStats", () => {
	it("reports the worst one percent as the 1% low", () => {
		const stats = new FrameStats();
		for (let index = 0; index < 99; index++) stats.push(10, index * 10);
		stats.push(100, 1000);
		const snapshot = stats.snapshot(16.7);
		expect(snapshot.samples).toBe(100);
		expect(snapshot.onePercentLowMs).toBe(100);
		expect(snapshot.worstMs).toBe(100);
		expect(snapshot.overBudgetPercent).toBe(1);
	});

	it("ignores impossible deltas and keeps a bounded history", () => {
		const stats = new FrameStats();
		stats.push(0, 0);
		stats.push(9999, 10);
		stats.push(16.7, 20);
		expect(stats.snapshot().samples).toBe(1);
		expect(stats.history(10).length).toBe(1);
	});
});

describe("QualityController", () => {
	it("steps down after sustained overload and respects the cap", () => {
		const controller = new QualityController();
		let level = 0;
		for (let index = 0; index < 200; index++)
			level = controller.update(20);
		expect(level).toBe(3);
		expect(controller.update(20, 0)).toBe(0);
	});

	it("steps back up after a long comfortable stretch", () => {
		const controller = new QualityController();
		for (let index = 0; index < 200; index++) controller.update(20);
		expect(controller.current).toBe(3);
		for (let index = 0; index < 3000; index++) controller.update(8);
		expect(controller.current).toBeLessThan(3);
	});

	it("does not downgrade on a single slow frame", () => {
		const controller = new QualityController();
		expect(controller.update(60)).toBe(0);
		expect(controller.update(8)).toBe(0);
	});
});
