/**
 * Collaboration data that lives beside the TTML document.
 *
 * Comments, review marks, room history, invites, and follow state are never
 * written into exported TTML. They are exchanged over the room socket and
 * mirrored into local project notes so reopening a project restores them.
 */

import type { CollabRole } from "./permissions";

export interface CollabMember {
	id: string;
	name: string;
	color: string;
	role: CollabRole;
	online: boolean;
	joinedAt: number;
	/** True while the person is waiting for host approval. */
	pending?: boolean;
}

export interface CollabComment {
	id: string;
	/** Stable lyric line id, never an array index. */
	lineId: string;
	/** Optional stable word id inside the line. */
	wordId?: string;
	/** Reply target within the same line thread. */
	parentId?: string;
	authorId: string;
	authorName: string;
	authorColor: string;
	text: string;
	at: number;
	editedAt?: number;
	resolved?: boolean;
	resolvedBy?: string;
	resolvedAt?: number;
	/** Users mentioned with @name in the text. */
	mentions?: string[];
}

export interface CollabCommentThread {
	lineId: string;
	wordId?: string;
	comments: CollabComment[];
	openCount: number;
	lastAt: number;
}

export type ReviewStatus = "ok" | "needs-fix" | "unsure";

export interface CollabReviewMark {
	/** Stable lyric line id. */
	lineId: string;
	status: ReviewStatus;
	note?: string;
	authorId: string;
	authorName: string;
	at: number;
	/** Present when a previous mark was replaced. */
	previousStatus?: ReviewStatus;
}

export interface CollabClaim {
	lineId: string;
	clientId: string;
	name: string;
	color: string;
	expiresAt: number;
	/** Optional short note such as "I'm syncing verse 2". */
	note?: string;
}

export type CollabHistoryKind =
	| "lyrics"
	| "timing"
	| "insert"
	| "delete"
	| "order"
	| "metadata"
	| "role"
	| "audio"
	| "comment"
	| "review"
	| "rollback"
	| "restore-point"
	| "invite"
	| "policy";

export interface CollabHistoryEntry {
	id: string;
	at: number;
	authorId: string;
	authorName: string;
	kind: CollabHistoryKind;
	summary: string;
	lineIds: string[];
	/** Compact line snapshots; enough to show before/after and revert. */
	before?: unknown;
	after?: unknown;
	/** Set on a rollback so it is never mistaken for the original edit. */
	revertOf?: string;
}

export interface CollabRestorePoint {
	id: string;
	name: string;
	at: number;
	authorName: string;
	lineCount: number;
	automatic: boolean;
}

export interface CollabInvite {
	id: string;
	/** Unguessable, cryptographically random code. */
	code: string;
	label?: string;
	role: CollabRole;
	expiresAt: number | null;
	maxUses: number | null;
	uses: number;
	createdAt: number;
	revoked: boolean;
	hasPassword: boolean;
	requireApproval: boolean;
}

export interface CollabWaitingPeer {
	id: string;
	name: string;
	color: string;
	at: number;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
	ok: "OK",
	"needs-fix": "Needs fix",
	unsure: "Unsure",
};

/** Aggregate review state for a line across every reviewer. */
export function aggregateReviewStatus(
	marks: CollabReviewMark[],
	lineId: string,
): ReviewStatus | null {
	let status: ReviewStatus | null = null;
	for (const mark of marks) {
		if (mark.lineId !== lineId) continue;
		if (mark.status === "needs-fix") return "needs-fix";
		if (mark.status === "unsure") status = "unsure";
		else if (!status) status = "ok";
	}
	return status;
}

export function reviewMarkFor(
	marks: CollabReviewMark[],
	lineId: string,
	authorId: string,
): CollabReviewMark | undefined {
	return marks.find(
		(mark) => mark.lineId === lineId && mark.authorId === authorId,
	);
}

export function groupCommentThreads(
	comments: CollabComment[],
): CollabCommentThread[] {
	const byLine = new Map<string, CollabComment[]>();
	for (const comment of comments) {
		if (comment.parentId) continue;
		const key = `${comment.lineId}\u0000${comment.wordId ?? ""}`;
		const list = byLine.get(key) ?? [];
		list.push(comment);
		byLine.set(key, list);
	}
	const threads: CollabCommentThread[] = [];
	for (const list of byLine.values()) {
		const withReplies = list.flatMap((root) => {
			const replies = comments
				.filter((comment) => comment.parentId === root.id)
				.sort((a, b) => a.at - b.at);
			return [root, ...replies];
		});
		const latest = withReplies.reduce(
			(max, comment) => Math.max(max, comment.at),
			0,
		);
		threads.push({
			lineId: list[0].lineId,
			wordId: list[0].wordId,
			comments: withReplies.sort((a, b) => a.at - b.at),
			openCount: withReplies.filter((comment) => !comment.resolved).length,
			lastAt: latest,
		});
	}
	return threads.sort((a, b) => b.lastAt - a.lastAt);
}

export function commentCountByLine(
	comments: CollabComment[],
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const comment of comments) {
		if (comment.parentId) continue;
		counts.set(comment.lineId, (counts.get(comment.lineId) ?? 0) + 1);
	}
	return counts;
}

export function openCommentCount(comments: CollabComment[]): number {
	return comments.filter((comment) => !comment.parentId && !comment.resolved)
		.length;
}

export function extractMentions(text: string, names: string[]): string[] {
	const found = new Set<string>();
	for (const name of names) {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		if (new RegExp(`@${escaped}\\b`, "iu").test(text)) found.add(name);
	}
	return [...found];
}

/** Existing locks double as expiring line claims in the room UI. */
export function liveClaims<T extends { expiresAt: number; name: string }>(
	claims: T[],
	now = Date.now(),
): T[] {
	return claims.filter((claim) => claim.expiresAt > now);
}
