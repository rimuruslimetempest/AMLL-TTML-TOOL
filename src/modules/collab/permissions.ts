/**
 * Central role and permission model for live rooms.
 *
 * The same table is used by the client (to disable controls with an
 * explanation) and mirrored by the Rust relay (which rejects operations the
 * sender's role does not allow), so a modified client cannot bypass it.
 */

export type CollabRole = "host" | "editor" | "commenter" | "viewer";

export type CollabPermission =
	| "editLyrics"
	| "editTiming"
	| "comment"
	| "review"
	| "manageRoles"
	| "manageInvites"
	| "kick"
	| "lockRoom"
	| "rollback"
	| "transferHost"
	| "viewSongInfo"
	| "editSongInfo"
	| "viewRoomSplits"
	| "addRoomSplit"
	| "removeRoomSplit";

export interface RoomPolicy {
	/** Role granted to people who join without a more specific invite. */
	defaultRole: CollabRole;
	/** Whether editors may revert history entries and restore points. */
	editorsCanRollback: boolean;
	/** No new joiners until the host unlocks the room. */
	locked: boolean;
	/** New joiners wait for host approval before entering. */
	approveJoiners: boolean;
}

export const DEFAULT_ROOM_POLICY: RoomPolicy = {
	defaultRole: "editor",
	editorsCanRollback: false,
	locked: false,
	approveJoiners: false,
};

export const ASSIGNABLE_ROLES: CollabRole[] = [
	"editor",
	"commenter",
	"viewer",
];

const ROLE_RANK: Record<CollabRole, number> = {
	viewer: 0,
	commenter: 1,
	editor: 2,
	host: 3,
};

export function isCollabRole(value: unknown): value is CollabRole {
	return (
		value === "host" ||
		value === "editor" ||
		value === "commenter" ||
		value === "viewer"
	);
}

export function roleRank(role: CollabRole | null | undefined): number {
	return role ? ROLE_RANK[role] : -1;
}

export function roleLabel(role: CollabRole | null | undefined): string {
	switch (role) {
		case "host":
			return "Host";
		case "editor":
			return "Editor";
		case "commenter":
			return "Commenter";
		case "viewer":
			return "Viewer";
		default:
			return "Guest";
	}
}

export function roleDescription(role: CollabRole): string {
	switch (role) {
		case "host":
			return "Full control of the room, people, and history.";
		case "editor":
			return "Can edit lyrics, splits, and timing.";
		case "commenter":
			return "Can add comments and review marks, but cannot edit lyrics or timing.";
		case "viewer":
			return "Read-only: can follow people and listen.";
	}
}

export function can(
	role: CollabRole | null | undefined,
	permission: CollabPermission,
	policy: RoomPolicy = DEFAULT_ROOM_POLICY,
): boolean {
	if (!role) return false;
	switch (permission) {
		case "editLyrics":
		case "editTiming":
			return role === "host" || role === "editor";
		case "comment":
		case "review":
			return role === "host" || role === "editor" || role === "commenter";
		case "rollback":
			return role === "host" || (role === "editor" && policy.editorsCanRollback);
		case "manageRoles":
		case "manageInvites":
		case "kick":
		case "lockRoom":
		case "transferHost":
			return role === "host";
		case "viewSongInfo":
		case "viewRoomSplits":
			return role !== "viewer";
		case "editSongInfo":
		case "addRoomSplit":
			return role === "host" || role === "editor";
		case "removeRoomSplit":
			return role === "host";
	}
}

const DENIAL: Record<CollabPermission, string> = {
	editLyrics:
		"Viewers can't edit. Ask the host for editor access.",
	editTiming:
		"Viewers can't change timing. Ask the host for editor access.",
	comment:
		"Viewers can't add comments. Ask the host for commenter access.",
	review:
		"Viewers can't review lines. Ask the host for commenter access.",
	manageRoles: "Only the host can change roles.",
	manageInvites: "Only the host can manage invites.",
	kick: "Only the host can remove people from the room.",
	lockRoom: "Only the host can lock the room.",
	rollback: "Only the host can roll back changes.",
	transferHost: "Only the host can hand over the host role.",
	viewSongInfo:
		"Viewers cannot see song info. Ask the host for commenter access.",
	editSongInfo:
		"Only editors and the host can change song info. Ask the host for editor access.",
	viewRoomSplits:
		"Viewers cannot browse room splits. Ask the host for commenter access.",
	addRoomSplit:
		"Only editors and the host can share splits with the room.",
	removeRoomSplit: "Only the host can remove shared splits.",
};

/** A friendly, role-aware explanation shown instead of a silent no-op. */
export function denialMessage(
	role: CollabRole | null | undefined,
	permission: CollabPermission,
): string {
	if (!role) return "Join a live room to do that.";
	if (role === "editor" && permission === "rollback") {
		return "Only the host can roll back changes in this room.";
	}
	if (role === "commenter") {
		if (permission === "editLyrics" || permission === "editTiming") {
			return "Commenters can't edit lyrics or timing. Ask the host for editor access.";
		}
	}
	return DENIAL[permission];
}

/** Sorting order for the collaborator list: host first, then by role. */
export function compareRoles(a: CollabRole, b: CollabRole): number {
	return ROLE_RANK[b] - ROLE_RANK[a];
}
