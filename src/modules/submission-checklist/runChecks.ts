import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import type { TTMLLyric } from "$/types/ttml";
import {
	getProjectLanguage,
	getTimingMode,
	SUBMISSION_RULES,
} from "./submissionRules";
import type {
	SubmissionCheckOptions,
	SubmissionCheckResult,
	SubmissionInfo,
	SubmissionIssue,
	SubmissionLevel,
	SubmissionPassedRule,
} from "./types";

const BLOCKING_LEVELS = new Set<SubmissionLevel>(["required", "forbidden"]);

const LEVEL_ORDER: Record<SubmissionLevel, number> = {
	forbidden: 0,
	required: 1,
	recommended: 2,
	discouraged: 3,
};

const issueId = (
	ruleId: string,
	finding: {
		lineIndex?: number;
		wordIndex?: number;
		detail: string;
	},
): string =>
	`submission:${ruleId}:${finding.lineIndex ?? "meta"}:${
		finding.wordIndex ?? "-"
	}:${finding.detail}`;

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/**
 * Runs every checklist rule against the current in-memory project. Nothing is
 * mutated: the same export function used by Save TTML builds the text that is
 * parsed back, and the writer is run a second time to verify a clean reload.
 */
export function runSubmissionChecks(
	lyric: TTMLLyric,
	options: SubmissionCheckOptions = {},
): SubmissionCheckResult {
	let exportedTTML = "";
	let exportError: string | null = null;

	try {
		exportedTTML = exportTTMLText(lyric, options.normalization, {
			allowConsecutiveBackgroundLines: options.allowConsecutiveBackgroundLines,
		});
	} catch (error) {
		exportError = errorMessage(error);
	}

	const lineNumbers = getLineDisplayNumbers(lyric.lyricLines);
	const context = {
		lyric,
		exportedTTML,
		exportError,
		lineNumbers,
		projectLanguage: getProjectLanguage(lyric),
		timingMode: getTimingMode(lyric),
	};

	const dismissed = new Set(options.dismissedIssueIds ?? []);
	const seen = new Set<string>();
	const issues: SubmissionIssue[] = [];
	const passedRules: SubmissionPassedRule[] = [];
	let dismissedCount = 0;

	for (const rule of SUBMISSION_RULES) {
		let findings: ReturnType<typeof rule.check>;
		try {
			findings = rule.check(context);
		} catch (error) {
			findings = [
				{
					lineIndex: 0,
					detail: `This check could not run: ${errorMessage(error)}`,
				},
			];
		}

		if (findings.length === 0) {
			passedRules.push({
				id: rule.id,
				level: rule.level,
				category: rule.category,
				message: rule.message,
			});
			continue;
		}

		for (const finding of findings) {
			const id = issueId(rule.id, finding);
			if (seen.has(id)) continue;
			seen.add(id);
			if (dismissed.has(id)) {
				dismissedCount += 1;
				continue;
			}

			const lineIndices =
				finding.lineIndices ??
				(finding.lineIndex === undefined ? [] : [finding.lineIndex]);
			const issueLines = Array.from(
				new Set(lineIndices.map((index) => lineNumbers[index] ?? index + 1)),
			);

			issues.push({
				...finding,
				id,
				ruleId: rule.id,
				level: rule.level,
				category: rule.category,
				ruleMessage: rule.message,
				ruleHint: rule.fixHint,
				line:
					finding.lineIndex === undefined
						? undefined
						: (lineNumbers[finding.lineIndex] ?? finding.lineIndex + 1),
				lines: issueLines.length > 1 ? issueLines : undefined,
				dismissible: Boolean(rule.dismissible),
				actionLabel: rule.actionLabel,
			});
		}
	}

	issues.sort(
		(a, b) =>
			LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
			(a.lineIndex ?? Number.MAX_SAFE_INTEGER) -
				(b.lineIndex ?? Number.MAX_SAFE_INTEGER) ||
			(a.wordIndex ?? Number.MAX_SAFE_INTEGER) -
				(b.wordIndex ?? Number.MAX_SAFE_INTEGER),
	);

	const blockedCount = issues.filter((issue) =>
		BLOCKING_LEVELS.has(issue.level),
	).length;
	const warningCount = issues.length - blockedCount;

	return {
		issues,
		passedRules,
		dismissedCount,
		blockedCount,
		warningCount,
		ranAt: Date.now(),
		projectLanguage: context.projectLanguage,
		timingMode: context.timingMode,
	};
}

export function isBlockingIssue(issue: SubmissionIssue): boolean {
	return BLOCKING_LEVELS.has(issue.level);
}

export function getBlockingIssues(
	result: SubmissionCheckResult,
): SubmissionIssue[] {
	return result.issues.filter(isBlockingIssue);
}

export function formatBlockingSummary(result: SubmissionCheckResult): string {
	const required = result.issues.filter(
		(issue) => issue.level === "required",
	).length;
	const forbidden = result.issues.filter(
		(issue) => issue.level === "forbidden",
	).length;
	const parts: string[] = [];
	if (required > 0) {
		parts.push(`${required} required issue${required === 1 ? "" : "s"}`);
	}
	if (forbidden > 0) {
		parts.push(`${forbidden} forbidden issue${forbidden === 1 ? "" : "s"}`);
	}
	return parts.join(" and ");
}

export function formatSubmissionSummary(result: SubmissionCheckResult): string {
	if (result.blockedCount === 0) {
		if (result.warningCount === 0) return "Ready to submit";
		return `Ready to submit — ${result.warningCount} warning${
			result.warningCount === 1 ? "" : "s"
		}`;
	}

	const required = result.issues.filter(
		(issue) => issue.level === "required",
	).length;
	const forbidden = result.issues.filter(
		(issue) => issue.level === "forbidden",
	).length;
	const warnings = result.issues.filter(
		(issue) => issue.level === "recommended" || issue.level === "discouraged",
	).length;
	const parts: string[] = [];
	if (required > 0) {
		parts.push(`${required} required issue${required === 1 ? "" : "s"}`);
	}
	if (forbidden > 0) {
		parts.push(`${forbidden} forbidden issue${forbidden === 1 ? "" : "s"}`);
	}
	if (warnings > 0) {
		parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
	}
	return parts.join(", ");
}

export function formatSubmissionMessage(
	result: SubmissionCheckResult,
	info: SubmissionInfo,
): string {
	const lines: string[] = [];
	const links = info.songLinks.trim();
	const notes = info.versionNotes.trim();
	if (links) lines.push(`Song link(s): ${links}`);
	if (notes) lines.push(`Version notes: ${notes}`);
	lines.push(`Checklist: ${formatSubmissionSummary(result)}`);
	return lines.join("\n");
}
