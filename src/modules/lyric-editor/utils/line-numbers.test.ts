import { describe, expect, it } from "vitest";
import { findLineIndexByDisplayNumber, getLineDisplayNumbers } from "./line-numbers";

const main = { isBG: false };
const bg = { isBG: true };

describe("getLineDisplayNumbers", () => {
	it("counts main lines and lets background lines share the parent number", () => {
		expect(getLineDisplayNumbers([main, bg, bg, main, bg, main])).toEqual([
			1, 1, 1, 2, 2, 3,
		]);
	});

	it("counts a leading background line as the first line", () => {
		expect(getLineDisplayNumbers([bg, main])).toEqual([1, 2]);
	});

	it("handles an empty project", () => {
		expect(getLineDisplayNumbers([])).toEqual([]);
	});
});

describe("findLineIndexByDisplayNumber", () => {
	it("returns the parent line of a background run", () => {
		expect(findLineIndexByDisplayNumber([main, bg, bg, main], 2)).toBe(3);
		expect(findLineIndexByDisplayNumber([main, bg, bg, main], 1)).toBe(0);
	});

	it("returns -1 when the number does not exist", () => {
		expect(findLineIndexByDisplayNumber([main, bg], 9)).toBe(-1);
	});
});