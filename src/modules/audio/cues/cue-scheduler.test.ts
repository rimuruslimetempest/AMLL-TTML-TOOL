import { describe, expect, it } from "vitest";
import { type CueClock, CueScheduler, lowerBoundTime } from "./cue-scheduler";
import type { CueEvent } from "./cue-sources";

const cue = (timeMs: number): CueEvent => ({
	id: `cue:${timeMs}`,
	timeMs,
	kind: "marks",
});

const clock = (overrides: Partial<CueClock> = {}): CueClock => ({
	timelineMs: 1000,
	contextTime: 10,
	rate: 1,
	playing: true,
	...overrides,
});

describe("lowerBoundTime", () => {
	it("finds the first cue at or after the requested time", () => {
		const cues = [cue(100), cue(300), cue(500)];
		expect(lowerBoundTime(cues, 0)).toBe(0);
		expect(lowerBoundTime(cues, 300)).toBe(1);
		expect(lowerBoundTime(cues, 301)).toBe(2);
		expect(lowerBoundTime(cues, 999)).toBe(3);
	});
});

describe("CueScheduler", () => {
	it("schedules cues inside the lookahead and skips ones already behind", () => {
		const scheduler = new CueScheduler(0.15);
		scheduler.setCues([cue(900), cue(1050), cue(1200)]);
		scheduler.rearm(1000);

		const scheduled: Array<{ cue: CueEvent; at: number }> = [];
		scheduler.tick(
			clock(),
			(seconds) => 10 + (seconds * 1000 - 1000) / 1000,
			(scheduledCue, at) => scheduled.push({ cue: scheduledCue, at }),
		);

		expect(scheduled).toHaveLength(1);
		expect(scheduled[0].cue.timeMs).toBe(1050);
		expect(scheduled[0].at).toBeCloseTo(10.05, 6);
	});

	it("advances the horizon with the playback rate", () => {
		const scheduler = new CueScheduler(0.15);
		scheduler.setCues([cue(1050), cue(1200), cue(1400)]);
		scheduler.rearm(1000);

		const scheduled: number[] = [];
		scheduler.tick(
			clock({ rate: 2 }),
			(seconds) => 10 + (seconds * 1000 - 1000) / 2000,
			(scheduledCue) => scheduled.push(scheduledCue.timeMs),
		);

		expect(scheduled).toEqual([1050, 1200]);
	});

	it("does nothing while paused", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1050)]);
		scheduler.rearm(1000);

		let calls = 0;
		scheduler.tick(
			clock({ playing: false }),
			() => 10,
			() => calls++,
		);
		expect(calls).toBe(0);
	});

	it("drops a cue whose mapped time is already late", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1050)]);
		scheduler.rearm(1000);

		let calls = 0;
		scheduler.tick(
			clock(),
			() => 9.5,
			() => calls++,
		);
		expect(calls).toBe(0);
	});

	it("never schedules a cue twice without a rearm", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1050)]);
		scheduler.rearm(1000);

		let calls = 0;
		const map = (seconds: number) => 10 + (seconds * 1000 - 1000) / 1000;
		scheduler.tick(clock(), map, () => calls++);
		scheduler.tick(clock(), map, () => calls++);
		expect(calls).toBe(1);

		scheduler.rearm(1000);
		scheduler.tick(clock(), map, () => calls++);
		expect(calls).toBe(2);
	});
});

describe("CueScheduler edge cases", () => {
	it("skips a cue exactly at the playhead", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1000)]);
		scheduler.rearm(1000);

		let calls = 0;
		scheduler.tick(
			clock(),
			() => 10,
			() => calls++,
		);
		expect(calls).toBe(0);
	});

	it("schedules from a replaced cue list after a rearm", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1050)]);
		scheduler.rearm(1000);
		scheduler.setCues([cue(1020)]);
		scheduler.rearm(1000);

		const times: number[] = [];
		scheduler.tick(
			clock(),
			(seconds) => 10 + (seconds * 1000 - 1000) / 1000,
			(scheduledCue) => times.push(scheduledCue.timeMs),
		);
		expect(times).toEqual([1020]);
	});

	it("shrinks the lookahead at half playback speed", () => {
		const scheduler = new CueScheduler(0.15);
		scheduler.setCues([cue(1030), cue(1060), cue(1100)]);
		scheduler.rearm(1000);

		const times: number[] = [];
		scheduler.tick(
			clock({ rate: 0.5 }),
			(seconds) => 10 + (seconds * 1000 - 1000) / 500,
			(scheduledCue) => times.push(scheduledCue.timeMs),
		);
		expect(times).toEqual([1030, 1060]);
	});

	it("drops a cue when the clock mapping is unavailable", () => {
		const scheduler = new CueScheduler();
		scheduler.setCues([cue(1050)]);
		scheduler.rearm(1000);

		let calls = 0;
		scheduler.tick(
			clock(),
			() => null,
			() => calls++,
		);
		expect(calls).toBe(0);
	});
});
