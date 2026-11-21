import type { ProjectInfo, ProjectVersion } from "$/modules/project/autosave/autosave";
import type { SavedSplitPattern } from "$/modules/split-library/types";
import type { ThemePack } from "$/modules/themes/types";
import type { LyricLine, LyricWord } from "$/types/ttml";

export const RECYCLE_BIN_VERSION = 1;
export const RECYCLE_BIN_FILE = "recycle-bin.json";
export const RECYCLE_BIN_FOLDER = "recycle-bin";
export const RECYCLE_BIN_FALLBACK_KEY = "amll_recycle_bin_v1";

export type RecycleKind = "line" | "word" | "project" | "split" | "theme";

export interface RecycleItemBase {
	id: string;
	kind: RecycleKind;
	name: string;
	deletedAt: number;
	projectId?: string;
	projectName?: string;
	/** Approximate stored size in bytes, used for the size cap. */
	size: number;
}

export interface RemovedLine {
	line: LyricLine;
	index: number;
	previousId: string | null;
	nextId: string | null;
	originalId: string;
}

export interface LineRecycleItem extends RecycleItemBase {
	kind: "line";
	payload: { lines: RemovedLine[] };
}

export interface RemovedWord {
	word: LyricWord;
	lineId: string;
	lineText: string;
	index: number;
	previousId: string | null;
	nextId: string | null;
	originalId: string;
}

export interface WordRecycleItem extends RecycleItemBase {
	kind: "word";
	payload: { words: RemovedWord[] };
}

export interface ProjectRecycleItem extends RecycleItemBase {
	kind: "project";
	payload: {
		/** Base64 of a gzip-compressed { project, versions } JSON object. */
		compressed: string;
	};
}

export interface SplitRecycleItem extends RecycleItemBase {
	kind: "split";
	payload: { pattern: SavedSplitPattern; wasDefault: boolean };
}

export interface ThemeRecycleItem extends RecycleItemBase {
	kind: "theme";
	payload: { theme: ThemePack };
}

export type RecycleItem =
	| LineRecycleItem
	| WordRecycleItem
	| ProjectRecycleItem
	| SplitRecycleItem
	| ThemeRecycleItem;

export type RetentionDays = 7 | 30 | 90 | "never";

export interface RecycleBinSettings {
	retentionDays: RetentionDays;
	maxBytes: number;
}

export interface RecycleBinFile {
	version: typeof RECYCLE_BIN_VERSION;
	items: RecycleItem[];
	settings: RecycleBinSettings;
}

export const DEFAULT_RECYCLE_SETTINGS: RecycleBinSettings = {
	retentionDays: 30,
	maxBytes: 500 * 1024 * 1024,
};

export const EMPTY_RECYCLE_BIN: RecycleBinFile = {
	version: RECYCLE_BIN_VERSION,
	items: [],
	settings: DEFAULT_RECYCLE_SETTINGS,
};

export interface ProjectArchive {
	project: ProjectInfo;
	versions: ProjectVersion[];
}

export type { ProjectInfo, ProjectVersion };
