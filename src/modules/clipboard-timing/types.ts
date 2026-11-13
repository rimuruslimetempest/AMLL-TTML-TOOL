/** Clipboard payloads for manual timing and lyric text shortcuts. */

export interface ClipboardWordTiming {
	word: string;
	startTime: number;
	endTime: number;
}

export interface LineTimingClipboard {
	kind: "line-timing";
	version: 1;
	sourceLineId: string;
	text: string;
	startTime: number;
	endTime: number;
	words: ClipboardWordTiming[];
	copiedAt: number;
}

export interface LineTextClipboard {
	kind: "line-text";
	version: 1;
	text: string;
	copiedAt: number;
}

export interface LineFullClipboard {
	kind: "line-full";
	version: 1;
	text: string;
	startTime: number;
	endTime: number;
	words: ClipboardWordTiming[];
	isBG: boolean;
	isDuet: boolean;
	agent?: string;
	language?: string;
	translatedLyric: string;
	romanLyric: string;
	copiedAt: number;
}

export type ClipboardPayload =
	| LineTimingClipboard
	| LineTextClipboard
	| LineFullClipboard;

export type PasteMode = "position" | "stretch";

export interface PasteOptions {
	mode: PasteMode;
	offsetMs: number;
	relative: boolean;
	/** Playhead time in ms, used when pasting as relative. */
	startAt: number;
}

export interface PasteRow {
	wordId: string;
	text: string;
	startTime: number;
	endTime: number;
	wasTimed: boolean;
}

export interface PastePreview {
	rows: PasteRow[];
	sourceCount: number;
	targetCount: number;
	mismatch: boolean;
}
