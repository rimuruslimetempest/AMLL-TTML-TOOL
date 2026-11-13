import type {
	CollabComment,
	CollabHistoryEntry,
	CollabRestorePoint,
	CollabReviewMark,
} from "./model";

/**
 * Project-side notes that must survive save/reopen but must never enter TTML.
 * The TTML writer only reads lyric lines, metadata, marks, and sections, so
 * this sidecar is safe by construction.
 */
export interface ProjectCollabData {
	version: 1;
	comments: CollabComment[];
	reviewMarks: CollabReviewMark[];
	history: CollabHistoryEntry[];
	restorePoints: CollabRestorePoint[];
	translationLanguage: string;
	romanizationLanguage: string;
	savedAt: number;
}

const KEY_PREFIX = "amll_project_notes_v1:";
const MAX_STORED_HISTORY = 500;
const MAX_STORED_COMMENTS = 2000;

export function emptyProjectCollabData(): ProjectCollabData {
	return {
		version: 1,
		comments: [],
		reviewMarks: [],
		history: [],
		restorePoints: [],
		translationLanguage: "",
		romanizationLanguage: "",
		savedAt: Date.now(),
	};
}

function storageKey(projectId: string): string {
	return `${KEY_PREFIX}${projectId}`;
}

export function loadProjectCollabData(
	projectId: string,
): ProjectCollabData | null {
	if (typeof localStorage === "undefined" || !projectId) return null;
	try {
		const raw = localStorage.getItem(storageKey(projectId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<ProjectCollabData> | null;
		if (!parsed || parsed.version !== 1) return null;
		return {
			version: 1,
			comments: Array.isArray(parsed.comments) ? parsed.comments : [],
			reviewMarks: Array.isArray(parsed.reviewMarks)
				? parsed.reviewMarks
				: [],
			history: Array.isArray(parsed.history) ? parsed.history : [],
			restorePoints: Array.isArray(parsed.restorePoints)
				? parsed.restorePoints
				: [],
			translationLanguage: parsed.translationLanguage ?? "",
			romanizationLanguage: parsed.romanizationLanguage ?? "",
			savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
		};
	} catch {
		return null;
	}
}

export function saveProjectCollabData(
	projectId: string,
	data: ProjectCollabData,
): void {
	if (typeof localStorage === "undefined" || !projectId) return;
	try {
		const compact: ProjectCollabData = {
			...data,
			version: 1,
			comments: data.comments.slice(-MAX_STORED_COMMENTS),
			history: data.history.slice(-MAX_STORED_HISTORY),
			savedAt: Date.now(),
		};
		localStorage.setItem(storageKey(projectId), JSON.stringify(compact));
	} catch {
		// Storage can be unavailable in private windows; room state still works
		// for the current session.
	}
}

export function clearProjectCollabData(projectId: string): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(storageKey(projectId));
	} catch {}
}

/** Plain-text review summary for the maker; never part of the TTML. */
export function buildReviewSummaryMarkdown(
	lines: { id: string; text: string }[],
	marks: CollabReviewMark[],
	comments: CollabComment[],
): string {
	const byLine = new Map<number, CollabReviewMark[]>();
	const indexById = new Map<string, number>();
	lines.forEach((line, index) => {
		indexById.set(line.id, index + 1);
	});
	for (const mark of marks) {
		if (mark.status === "ok") continue;
		const index = indexById.get(mark.lineId);
		if (!index) continue;
		const list = byLine.get(index) ?? [];
		list.push(mark);
		byLine.set(index, list);
	}
	const needed = [...byLine.entries()].sort((a, b) => a[0] - b[0]);
	const heading = `# Review notes\n\n${
		needed.length === 0
			? "Every reviewed line was marked OK.\n"
			: `${needed.length} line${needed.length === 1 ? "" : "s"} need attention.\n`
	}`;
	const body = needed
		.map(([index, lineMarks]) => {
			const line = lines[index - 1];
			const notes = lineMarks
				.map((mark) => {
					const label = mark.status === "needs-fix" ? "Needs fix" : "Unsure";
					const note = mark.note?.trim();
					return `- ${label}${note ? `: ${note}` : ""} (${mark.authorName})`;
				})
				.join("\n");
			const lineComments = comments
				.filter(
					(comment) =>
						comment.lineId === line?.id &&
						!comment.parentId &&
						!comment.resolved,
				)
				.map((comment) => `  - Comment: ${comment.text}`)
				.join("\n");
			return `## Line ${index}: ${line?.text ?? ""}\n${notes}${
				lineComments ? `\n${lineComments}` : ""
			}`;
		})
		.join("\n\n");
	return `${heading}${body ? `\n${body}\n` : ""}`;
}

/** One translation or romanization entry per lyric line, in editor order. */
export function translationsToText(values: string[]): string {
	return values.map((value) => value.replace(/\r?\n/gu, " ")).join("\n");
}

export function parseTranslationText(
	text: string,
	expectedLines: number,
): { values: string[]; error: string | null } {
	const values = text.replace(/\r\n/gu, "\n").split("\n");
	if (values.length > 0 && values[values.length - 1] === "") values.pop();
	if (values.length !== expectedLines) {
		return {
			values,
			error: `Expected ${expectedLines} lines but found ${values.length}.`,
		};
	}
	return { values, error: null };
}
