import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";
import {
	getLineIdAtClampedIndex,
	getNearestRemainingLineId,
	getPrimarySelectedLineId,
	shouldAutoCenterSelection,
} from "./selection-scroll";

const lines = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("shouldAutoCenterSelection", () => {
	it("keeps direct Edit-mode selections stationary", () => {
		expect(shouldAutoCenterSelection(ToolMode.Edit)).toBe(false);
	});

	it("preserves automatic centering in Sync mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Sync)).toBe(true);
	});

	it("does not auto-center selections in Preview mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Preview)).toBe(false);
	});
});

describe("selection sync helpers", () => {
	it("uses the first selected line in document order", () => {
		expect(getPrimarySelectedLineId(lines, new Set(["c", "b"]))).toBe("b");
		expect(getPrimarySelectedLineId(lines, new Set())).toBeNull();
	});

	it("clamps a deleted line position to the nearest remaining line", () => {
		expect(getLineIdAtClampedIndex(lines, 9)).toBe("d");
		expect(getLineIdAtClampedIndex(lines, -2)).toBe("a");
		expect(getLineIdAtClampedIndex([], 0)).toBeNull();
	});

	it("picks the line at the old index after removing the selection", () => {
		expect(getNearestRemainingLineId(lines, new Set(["b", "c"]), 1)).toBe(
			"d",
		);
		expect(getNearestRemainingLineId(lines, new Set(lines.map((l) => l.id)), 0)).toBeNull();
	});
});
