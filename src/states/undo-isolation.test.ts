import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	lyricLinesAtom,
	newLyricLinesAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "./main";

function documentWith(text: string): TTMLLyric {
	const line = newLyricLine();
	line.startTime = 0;
	line.endTime = 1000;
	const word = newLyricWord();
	word.word = text;
	word.startTime = 0;
	word.endTime = 1000;
	line.words = [word];
	return { lyricLines: [line], metadata: [], marks: [], sections: [] };
}

function currentText(
	store: ReturnType<typeof createStore>,
): string | undefined {
	return store.get(lyricLinesAtom).lyricLines[0]?.words[0]?.word;
}

describe("lyric undo history", () => {
	it("does not cross documents when a project is loaded", () => {
		const store = createStore();

		store.set(newLyricLinesAtom, documentWith("Alpha"));
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);

		store.set(lyricLinesAtom, documentWith("Alpha edited"));
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(true);
		store.set(undoLyricLinesAtom);
		expect(currentText(store)).toBe("Alpha");

		store.set(newLyricLinesAtom, documentWith("Beta"));
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);
		store.set(undoLyricLinesAtom);
		expect(currentText(store)).toBe("Beta");

		store.set(lyricLinesAtom, documentWith("Beta edited"));
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(true);
		store.set(undoLyricLinesAtom);
		expect(currentText(store)).toBe("Beta");
	});
});
