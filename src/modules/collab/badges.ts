import { atom } from "jotai";
import { aggregateReviewStatus } from "./model";
import {
	collabCommentsAtom,
	collabLocksAtom,
	collabReviewMarksAtom,
} from "./states";

export interface LineBadges {
	comments: number;
	review: ReturnType<typeof aggregateReviewStatus>;
	claim?: { name: string; color: string; expiresAt: number };
}

/** One derived map for line-level comment, review, and claim badges. */
export const collabLineBadgesAtom = atom((get) => {
	const comments = get(collabCommentsAtom);
	const marks = get(collabReviewMarksAtom);
	const locks = get(collabLocksAtom);
	const now = Date.now();
	const map = new Map<string, LineBadges>();
	for (const comment of comments) {
		if (comment.parentId || comment.resolved) continue;
		const entry = map.get(comment.lineId) ?? {
			comments: 0,
			review: null,
		};
		entry.comments += 1;
		map.set(comment.lineId, entry);
	}
	for (const mark of marks) {
		const entry = map.get(mark.lineId) ?? { comments: 0, review: null };
		entry.review = aggregateReviewStatus(marks, mark.lineId);
		map.set(mark.lineId, entry);
	}
	for (const lock of locks) {
		if (lock.expiresAt <= now) continue;
		const entry = map.get(lock.lineId) ?? { comments: 0, review: null };
		if (!entry.claim) {
			entry.claim = {
				name: lock.name,
				color: lock.color,
				expiresAt: lock.expiresAt,
			};
			map.set(lock.lineId, entry);
		}
	}
	return map;
});
