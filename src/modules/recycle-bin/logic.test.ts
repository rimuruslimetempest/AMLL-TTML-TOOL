import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	daysLeft,
	enforceSizeCap,
	insertRemovedLines,
	insertRemovedWords,
	pruneExpired,
} from "./logic";
import type { RecycleItem, RemovedLine, RemovedWord } from "./types";

function item(id: string, deletedAt: number, size = 10): RecycleItem {
	return {
		id,
		kind: "split",
		name: id,
		deletedAt,
		size,
		payload: {
			pattern: {
				id,
				wordKey: id,
				displayWord: id,
				boundaries: [],
				label: "",
				note: "",
				isDefault: false,
				createdAt: 0,
				updatedAt: 0,
			},
			wasDefault: false,
		},
	};
}

describe("recycle bin retention", () => {
	const now = Date.UTC(2026, 10, 19);
	const day = 24 * 60 * 60 * 1000;

	it("removes records past the retention period and keeps newer ones", () => {
		const result = pruneExpired(
			[item("old", now - 31 * day), item("new", now - 2 * day)],
			30,
			now,
		);
		expect(result.kept.map((entry) => entry.id)).toEqual(["new"]);
		expect(result.removed.map((entry) => entry.id)).toEqual(["old"]);
	});

	it("keeps everything when retention is never", () => {
		const result = pruneExpired([item("old", 0)], "never", now);
		expect(result.kept).toHaveLength(1);
		expect(daysLeft(result.kept[0], "never", now)).toBeNull();
	});

	it("reports the remaining days", () => {
		expect(daysLeft(item("a", now - 25 * day), 30, now)).toBe(5);
		expect(daysLeft(item("b", now - 40 * day), 30, now)).toBe(0);
	});

	it("drops the oldest records first when over the size cap", () => {
		const result = enforceSizeCap(
			[item("old", 1, 100), item("new", 2, 100), item("newest", 3, 100)],
			250,
		);
		expect(result.kept.map((entry) => entry.id)).toEqual(["new", "newest"]);
		expect(result.removed.map((entry) => entry.id)).toEqual(["old"]);
	});
});

describe("restoring deleted lines", () => {
	it("uses neighbor ids instead of the old array index", () => {
		const first = newLyricLine();
		first.id = "first";
		first.words = [];
		const last = newLyricLine();
		last.id = "last";
		const removed: RemovedLine = {
			line: { ...newLyricLine(), id: "removed" },
			index: 1,
			previousId: "first",
			nextId: "last",
			originalId: "removed",
		};
		const result = insertRemovedLines([first, last], [removed]);
		expect(result.lines.map((line) => line.id)).toEqual([
			"first",
			"removed",
			"last",
		]);
		expect(result.placements[0].index).toBe(1);
	});

	it("falls back to the nearest position when both neighbors are gone", () => {
		const only = newLyricLine();
		only.id = "only";
		const removed: RemovedLine = {
			line: { ...newLyricLine(), id: "removed" },
			index: 5,
			previousId: "missing-a",
			nextId: "missing-b",
			originalId: "removed",
		};
		const result = insertRemovedLines([only], [removed]);
		expect(result.lines.map((line) => line.id)).toEqual(["only", "removed"]);
		expect(result.placements[0].message).toContain("end");
	});

	it("issues a new id when the old one is already used", () => {
		const existing = newLyricLine();
		existing.id = "same";
		const removed: RemovedLine = {
			line: { ...newLyricLine(), id: "same" },
			index: 0,
			previousId: null,
			nextId: null,
			originalId: "same",
		};
		const result = insertRemovedLines([existing], [removed]);
		expect(result.lines).toHaveLength(2);
		expect(new Set(result.lines.map((line) => line.id)).size).toBe(2);
	});
});

describe("restoring deleted words", () => {
	it("puts a word back next to its previous word", () => {
		const line = newLyricLine();
		line.id = "line";
		const first = newLyricWord();
		first.id = "a";
		first.word = "Hello";
		const last = newLyricWord();
		last.id = "b";
		last.word = "world";
		line.words = [first, last];
		const removed: RemovedWord = {
			word: { ...newLyricWord(), id: "middle", word: "big" },
			lineId: "line",
			lineText: "Hello world",
			index: 1,
			previousId: "a",
			nextId: "b",
			originalId: "middle",
		};
		const result = insertRemovedWords(line, [removed]);
		expect(result.line.words.map((word) => word.word)).toEqual([
			"Hello",
			"big",
			"world",
		]);
	});
});
