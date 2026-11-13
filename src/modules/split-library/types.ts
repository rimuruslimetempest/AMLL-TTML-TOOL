/** Data stored in the personal split library. */

export type SplitSource = "manual" | "library" | "room" | "auto-segment";

export interface SavedSplitPattern {
	id: string;
	/** Unicode-normalized, case-insensitive word core. */
	wordKey: string;
	/** Original spelling used by the person who saved it. */
	displayWord: string;
	/** Boundaries relative to the undecorated word core. */
	boundaries: number[];
	/** Optional short name, such as "Chorus version". */
	label: string;
	note: string;
	isDefault: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface SplitLibrarySettings {
	/** Save to the library whenever a word is split in the split dialog. */
	rememberSplits: boolean;
	/** Offer the inline suggestion when one selected word has a saved pattern. */
	suggestSplits: boolean;
}

export interface SplitLibraryFile {
	version: 1;
	patterns: SavedSplitPattern[];
	settings: SplitLibrarySettings;
}

export interface SharedSplitSuggestion {
	id: string;
	wordKey: string;
	displayWord: string;
	boundaries: number[];
	label: string;
	note: string;
	addedById: string;
	addedByName: string;
	createdAt: number;
}

export interface SplitPatternPreview {
	lineId: string;
	lineIndex: number;
	wordId: string;
	wordIndex: number;
	lineText: string;
	current: string;
	next: string;
	patternId: string;
	patternLabel: string;
}

export const EMPTY_SPLIT_LIBRARY: SplitLibraryFile = {
	version: 1,
	patterns: [],
	settings: {
		rememberSplits: false,
		suggestSplits: true,
	},
};
