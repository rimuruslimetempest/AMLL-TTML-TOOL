import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	CollabChatMessage,
	CollabComment,
	CollabHistoryEntry,
	CollabInvite,
	CollabLineLock,
	CollabMember,
	CollabPeer,
	CollabRestorePoint,
	CollabReviewMark,
	CollabRole,
	CollabSession,
	CollabSharedMedia,
	CollabStatus,
	CollabWaitingPeer,
} from "./types";
import type { SharedSplitSuggestion } from "$/modules/split-library/types";
import { DEFAULT_ROOM_POLICY, type RoomPolicy } from "./permissions";

export type { CollabRole } from "./types";

export type CollabPanel =
	| "members"
	| "comments"
	| "history"
	| "review"
	| "translation"
	| "splits"
	| null;

export interface CollabFollowState {
	memberId: string;
	name: string;
	color: string;
	followPlayback: boolean;
}

export interface CollabPeerFocus {
	from: string;
	name: string;
	color: string;
	lineId: string;
	wordId?: string;
	at: number;
}

export const collabDialogOpenAtom = atom(false);
export const collabChatOpenAtom = atom(false);
export const collabPanelAtom = atom<CollabPanel>(null);
export const collabSessionAtom = atom<CollabSession | null>(null);
export const collabStatusAtom = atom<CollabStatus>("idle");
export const collabRoleAtom = atom<CollabRole | null>(null);
export const collabErrorAtom = atom<string | null>(null);
export const collabPeersAtom = atom<CollabPeer[]>([]);
export const collabMembersAtom = atom<CollabMember[]>([]);
export const collabWaitingAtom = atom<CollabWaitingPeer[]>([]);
export const collabPolicyAtom = atom<RoomPolicy>(DEFAULT_ROOM_POLICY);
export const collabInvitesAtom = atom<CollabInvite[]>([]);
export const collabCommentsAtom = atom<CollabComment[]>([]);
export const collabReviewMarksAtom = atom<CollabReviewMark[]>([]);
export const collabSplitDictionaryAtom = atom<SharedSplitSuggestion[]>([]);
export const collabHistoryAtom = atom<CollabHistoryEntry[]>([]);
export const collabRestorePointsAtom = atom<CollabRestorePoint[]>([]);
export const collabChatAtom = atom<CollabChatMessage[]>([]);
export const collabMediaAtom = atom<CollabSharedMedia[]>([]);
export const collabUnreadAtom = atom(0);
export const collabNameAtom = atomWithStorage("ttmlCollabName", "");
export const collabGuestKeyAtom = atomWithStorage(
	"ttmlCollabGuestKey",
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `guest-${Math.random().toString(36).slice(2)}`,
);
/** True while waiting for the host to approve this person into the room. */
export const collabPendingJoinAtom = atom(false);
/** Set when the host removes this person; the room data stays local. */
export const collabKickedAtom = atom<string | null>(null);
export const collabFollowAtom = atom<CollabFollowState | null>(null);
export const collabPeerFocusAtom = atom<CollabPeerFocus | null>(null);
/** Friendly, role-aware explanation for a disabled or rejected action. */
export const collabPermissionNoticeAtom = atom<string | null>(null);
export const collabLocalVersionAtom = atom(0);
export const collabRemoteEditAtAtom = atom(0);
/**
 * Explicitly hold remote edits until the local user resumes them. Edits made
 * while dragging or syncing playback are buffered independently of this switch.
 */
export const collabPauseIncomingAtom = atomWithStorage(
	"ttmlCollabPauseIncoming",
	false,
);
export const collabLatencyAtom = atom<number | null>(null);
export const collabSelfIdAtom = atom("");
export const collabLocksAtom = atom<CollabLineLock[]>([]);
export const collabQueuedChangesAtom = atom(0);
export const collabRemoteNoticeAtom = atom<{ count: number; at: number } | null>(
	null,
);
export const collabTurnedAwayFromTimingDragAtom = atom(false);

/** The item the local user is actively dragging, used to defer remote edits. */
export const collabInteractionAtom = atom<{
	lineId: string;
	wordId?: string;
	field: "line" | "word";
} | null>(null);

export const collabActiveAtom = atom((get) => {
	const status = get(collabStatusAtom);
	return (
		status === "connecting" ||
		status === "connected" ||
		status === "reconnecting"
	);
});

export const collabSelfRoleAtom = atom((get) => get(collabRoleAtom));
