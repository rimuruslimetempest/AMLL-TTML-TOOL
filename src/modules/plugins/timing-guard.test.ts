import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { assertToolTimingUnchanged, snapshotToolTiming } from "./timing-guard";

function makeLines(): LyricLine[] {
	const line = newLyricLine();
	line.id = "line-1";
	line.startTime = 1000;
	line.endTime = 3000;
	const first = newLyricWord();
	first.id = "word-1";
	first.word = "Hello";
	first.startTime = 1000;
	first.endTime = 1800;
	const second = newLyricWord();
	second.id = "word-2";
	second.word = "world";
	second.startTime = 1800;
	second.endTime = 3000;
	line.words = [first, second];
	return [line];
}

function copy(lines: LyricLine[]): LyricLine[] {
	return JSON.parse(JSON.stringify(lines)) as LyricLine[];
}

describe("tool timing guard", () => {
	it("allows text-only changes and preserves the result", () => {
		const original = makeLines();
		const result = copy(original);
		result[0].words[0].word = "HELLO";
		result[0].words[1].word = "WORLD";
		expect(
			assertToolTimingUnchanged(snapshotToolTiming(original), result),
		).toBe(result);
	});

	it("rejects a changed word timestamp", () => {
		const original = makeLines();
		const result = copy(original);
		result[0].words[0].startTime = 900;
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), result),
		).toThrow(/timing/i);
	});

	it("rejects a changed line timestamp", () => {
		const original = makeLines();
		const result = copy(original);
		result[0].endTime = 3100;
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), result),
		).toThrow(/timing/i);
	});

	it("rejects added or removed lines", () => {
		const original = makeLines();
		const result = copy(original);
		result.push(copy(original)[0]);
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), result),
		).toThrow(/line count/i);
	});

	it("rejects removed line fields and added word fields", () => {
		const original = makeLines();
		const missingLineField = copy(original);
		delete (missingLineField[0] as unknown as Record<string, unknown>)
			.translatedLyric;
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), missingLineField),
		).toThrow(/fields/i);

		const extraWordField = copy(original);
		(extraWordField[0].words[0] as unknown as Record<string, unknown>).extra =
			true;
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), extraWordField),
		).toThrow(/fields/i);
	});

	it("rejects added, removed, or renamed words", () => {
		const original = makeLines();
		const removed = copy(original);
		removed[0].words.pop();
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), removed),
		).toThrow(/word count/i);

		const renamed = copy(original);
		renamed[0].words[0].id = "other";
		expect(() =>
			assertToolTimingUnchanged(snapshotToolTiming(original), renamed),
		).toThrow(/identity/i);
	});
});
