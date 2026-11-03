export const AI_CHECK_SEVERITIES = ["error", "warning", "suggestion"] as const;

export const AI_CHECK_SCROLL_EVENT = "ai-check:scroll-to-line";

export type AiCheckSeverity = (typeof AI_CHECK_SEVERITIES)[number];

export const AI_CHECK_ISSUE_TYPES = [
	"timing",
	"text",
	"split",
	"format",
] as const;

export type AiCheckIssueType = (typeof AI_CHECK_ISSUE_TYPES)[number];

/** A fix that can be applied to the project without guessing. */
export interface AiCheckSyllableFix {
	kind: "syllableText";
	text: string;
}

export interface AiCheckIssue {
	id: string;
	/** 1-based line number, matching the numbers shown in the TTML review. */
	line: number;
	/** 0-based index in the project's lyricLines array, when known. */
	lineIndex?: number;
	/** 0-based index of the syllable inside the line, when word-level. */
	syllableIndex?: number;
	severity: AiCheckSeverity;
	type: AiCheckIssueType;
	message: string;
	suggestedFix?: string;
	/** Present only when the app can apply the fix mechanically. */
	fix?: AiCheckSyllableFix;
	source: "local" | "ai";
}

export interface AiCheckRunResult {
	issues: AiCheckIssue[];
	/** Non-fatal AI problems; local issues are still returned. */
	error?: string;
}

export const severityLabel = (severity: AiCheckSeverity): string => {
	switch (severity) {
		case "error":
			return "Error";
		case "warning":
			return "Warning";
		default:
			return "Suggestion";
	}
};

export const severityColor = (
	severity: AiCheckSeverity,
): "red" | "amber" | "blue" => {
	switch (severity) {
		case "error":
			return "red";
		case "warning":
			return "amber";
		default:
			return "blue";
	}
};

export const isAiCheckSeverity = (value: unknown): value is AiCheckSeverity =>
	typeof value === "string" &&
	(AI_CHECK_SEVERITIES as readonly string[]).includes(value);

export const isAiCheckIssueType = (value: unknown): value is AiCheckIssueType =>
	typeof value === "string" &&
	(AI_CHECK_ISSUE_TYPES as readonly string[]).includes(value);