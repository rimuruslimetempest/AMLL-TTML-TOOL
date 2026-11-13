import { atom } from "jotai";
import { buildPatternIndex } from "./logic";
import { EMPTY_SPLIT_LIBRARY, type SplitLibraryFile } from "./types";

export const splitLibraryAtom = atom<SplitLibraryFile>({
	...EMPTY_SPLIT_LIBRARY,
	patterns: [],
	settings: { ...EMPTY_SPLIT_LIBRARY.settings },
});
export const splitLibraryReadyAtom = atom(false);
/** Word-key to patterns; rebuilt only when the library changes. */
export const splitLibraryIndexAtom = atom((get) =>
	buildPatternIndex(get(splitLibraryAtom).patterns),
);
export const splitLibraryDialogAtom = atom(false);
export const applySavedSplitsDialogAtom = atom(false);
/** Set by an import flow to offer, never force, saved splits. */
export const savedSplitsImportOfferAtom = atom(0);
export const splitLibraryErrorAtom = atom<string | null>(null);
