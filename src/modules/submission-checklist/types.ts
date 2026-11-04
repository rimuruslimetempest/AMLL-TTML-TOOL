import type { TTMLLyric } from "$/types/ttml";
import type { LyricTextNormalizationOptions } from "$/utils/apostrophe-normalization";

export const SUBMISSION_LEVELS = [
	"required",
	"recommended",
	"discouraged",
	"forbidden",
] as const;

export type SubmissionLevel = (typeof SUBMISSION_LEVELS)[number];

export const SUBMISSION_LEVEL_LABELS: Record<SubmissionLevel, string> = {
	required: "Required",
	recommended: "Recommended",
	discouraged: "Discouraged",
	forbidden: "Forbidden",
};

export type SubmissionCategory =
	| "compatibility"
	| "text"
	| "timing"
	| "splitting"
	| "vocal-roles"
	| "romanization"
	| "metadata";

export const SUBMISSION_CATEGORY_LABELS: Record<SubmissionCategory, string> = {
	compatibility: "Compatibility",
	text: "Text and formatting",
	timing: "Timing",
	splitting: "Splitting",
	"vocal-roles": "Vocal roles",
	romanization: "Romanization",
	metadata: "Metadata",
};

export type SubmissionTimingMode = "line" | "word" | "mixed" | "none";

export type SubmissionFixKind = "remove-empty-lines";

export interface SubmissionFinding {
	/** Raw index into lyric.lyricLines, used to select and scroll. */
	lineIndex?: number;
	/** Additional raw line indices when one finding covers several lines. */
	lineIndices?: number[];
	/** Raw index into the line's words array. */
	wordIndex?: number;
	/** A metadata issue has no lyric line to jump to. */
	target?: "metadata";
	detail: string;
	fix?: SubmissionFixKind;
}

export interface SubmissionCheckContext {
	lyric: TTMLLyric;
	exportedTTML: string;
	exportError: string | null;
	lineNumbers: number[];
	projectLanguage: string | null;
	timingMode: SubmissionTimingMode;
}

export interface SubmissionRule {
	id: string;
	level: SubmissionLevel;
	category: SubmissionCategory;
	/** Short description of the rule, shown as the issue title. */
	message: string;
	/** Practical explanation of how to resolve it. */
	fixHint: string;
	check: (context: SubmissionCheckContext) => SubmissionFinding[];
	/** Only heuristic findings should allow a per-project dismissal. */
	dismissible?: boolean;
	/** Optional label for the dismissal action, e.g. "Mark checked". */
	actionLabel?: string;
}

export interface SubmissionIssue extends SubmissionFinding {
	id: string;
	ruleId: string;
	level: SubmissionLevel;
	category: SubmissionCategory;
	ruleMessage: string;
	ruleHint: string;
	/** Display line number (background lines share their parent number). */
	line?: number;
	/** Display line numbers when one finding covers several lines. */
	lines?: number[];
	dismissible: boolean;
	actionLabel?: string;
}

export interface SubmissionPassedRule {
	id: string;
	level: SubmissionLevel;
	category: SubmissionCategory;
	message: string;
}

export interface SubmissionCheckResult {
	issues: SubmissionIssue[];
	passedRules: SubmissionPassedRule[];
	dismissedCount: number;
	blockedCount: number;
	warningCount: number;
	ranAt: number;
	projectLanguage: string | null;
	timingMode: SubmissionTimingMode;
}

export interface SubmissionCheckOptions {
	normalization?: LyricTextNormalizationOptions;
	allowConsecutiveBackgroundLines?: boolean;
	dismissedIssueIds?: Iterable<string>;
}

export interface SubmissionManualItem {
	id: string;
	label: string;
}

export interface SubmissionManualSection {
	id: string;
	title: string;
	items: SubmissionManualItem[];
}

export type SubmissionRouteId = "no-role" | "maker" | "self-uploader";

export interface SubmissionRoute {
	id: SubmissionRouteId;
	label: string;
	steps: string[];
}

export interface SubmissionInfo {
	songLinks: string;
	versionNotes: string;
	spotifyIds: string;
}

export interface SubmissionChecklistProjectState {
	version: 1;
	manualChecks: Record<string, boolean>;
	dismissedIssueIds: string[];
	info: SubmissionInfo;
	route: SubmissionRouteId;
}

export const SUBMISSION_CHECKLIST_SCROLL_EVENT =
	"submission-checklist:scroll-to-line";
