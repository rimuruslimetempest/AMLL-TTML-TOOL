import type {
	LyricLine,
	LyricSection,
	Mark,
	TTMLMetadata,
	TTMLLyric,
} from "$/types/ttml";
import type {
	CollabComment,
	CollabHistoryEntry,
	CollabInvite,
	CollabMember,
	CollabRestorePoint,
	CollabReviewMark,
	CollabWaitingPeer,
} from "./model";
import type { SongInfo } from "$/modules/song-info/types";
import type { SharedSplitSuggestion } from "$/modules/split-library/types";
import type { CollabRole, RoomPolicy } from "./permissions";

export interface CollabLine {
	id: string;
	data: LyricLine;
}

export interface CollabProject {
	metadata: TTMLMetadata[];
	marks: Mark[];
	sections: LyricSection[];
	/** Project-only song information, shared with the song document. */
	songInfo?: SongInfo | null;
}

export interface CollabSnapshot {
	lines: CollabLine[];
	order: string[];
	project: CollabProject;
}

export interface CollabPatch {
	lines?: CollabLine[];
	removed?: string[];
	order?: string[];
	/** Insertions are relative to a neighbour, never an absolute index. */
	inserts?: CollabInsert[];
	project?: CollabProject;
}

export interface CollabInsert {
	id: string;
	afterId: string | null;
}

export interface CollabSession {
	url: string;
	localUrl: string;
	wsUrl: string;
	roomId: string;
	port: number;
	lanIp: string;
	remote: boolean;
}

export interface CollabPeer {
	id: string;
	name: string;
	color: string;
	role: CollabRole;
	joinedAt?: number;
	online?: boolean;
}

export interface CollabChatMessage {
	id: string;
	authorId: string;
	authorName: string;
	text: string;
	at: number;
}

export interface CollabSharedMedia {
	id: string;
	name: string;
	kind: "recording" | "audio";
	size: number;
	addedBy: string;
	at: number;
}

/** An advisory, expiring indicator that a peer is working on a line. */
export interface CollabLineLock {
	lineId: string;
	clientId: string;
	name: string;
	color: string;
	expiresAt: number;
}

export type CollabHealthTone = "green" | "amber" | "red" | "gray" | "blue";

export interface CollabHealthSummary {
	label: string;
	tone: CollabHealthTone;
	detail: string;
}

export function getCollabHealth(
	status: CollabStatus,
	latency: number | null,
): CollabHealthSummary {
	switch (status) {
		case "connected":
			if (latency === null) {
				return {
					label: "Connected",
					tone: "green",
					detail: "Live sync · measuring latency",
				};
			}
			if (latency <= 180) {
				return {
					label: "Good",
					tone: "green",
					detail: `Live sync · ${latency} ms round trip`,
				};
			}
			if (latency <= 450) {
				return {
					label: "Fair",
					tone: "amber",
					detail: `Live sync · ${latency} ms round trip`,
				};
			}
			return {
				label: "Slow",
				tone: "red",
				detail: `Live sync · ${latency} ms round trip`,
			};
		case "connecting":
			return {
				label: "Connecting",
				tone: "amber",
				detail: "Joining the room",
			};
		case "starting":
			return {
				label: "Starting",
				tone: "amber",
				detail: "Starting the room",
			};
		case "reconnecting":
			return {
				label: "Reconnecting",
				tone: "amber",
				detail: "Trying to restore live sync",
			};
		case "error":
			return {
				label: "Offline",
				tone: "red",
				detail: "The room connection was lost",
			};
		default:
			return { label: "Offline", tone: "gray", detail: "Not in a live room" };
	}
}

export function activeLineLocks(
	locks: CollabLineLock[],
	now = Date.now(),
): CollabLineLock[] {
	return locks.filter((lock) => lock.expiresAt > now);
}

/** Manual pause and temporary edit protection both hold remote patches. */
export function shouldHoldRemoteEdits({
	paused,
	interacting,
	syncing,
	playing,
}: {
	paused: boolean;
	interacting: boolean;
	syncing: boolean;
	playing: boolean;
}): boolean {
	return paused || interacting || (syncing && playing);
}

export type CollabStatus =
	| "idle"
	| "starting"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "error";

export type { CollabRole };

/** Everything a newly joined or newly approved person needs to catch up. */
export interface CollabRoomState {
	role: CollabRole;
	members: CollabMember[];
	comments: CollabComment[];
	reviewMarks: CollabReviewMark[];
	history: CollabHistoryEntry[];
	restorePoints: CollabRestorePoint[];
	invites: CollabInvite[];
	policy: RoomPolicy;
	waiting: CollabWaitingPeer[];
	/** Suggestions shared by people in the room; never applied automatically. */
	splitDictionary: SharedSplitSuggestion[];
}

export type CollabServerMessage =
	| ({
			type: "welcome";
			clientId: string;
			roomId: string;
			snapshot: CollabSnapshot;
			chat: CollabChatMessage[];
			peers: CollabPeer[];
			media: CollabSharedMedia[];
			locks?: CollabLineLock[];
	  } & CollabRoomState)
	| {
			type: "patch";
			from: string;
			opId?: string;
			seq?: number;
			lines?: CollabLine[];
			removed?: string[];
			order?: string[];
			inserts?: CollabInsert[];
			project?: CollabProject;
	  }
	| { type: "chat"; message: CollabChatMessage }
	| { type: "peers"; peers: CollabPeer[] }
	| { type: "locks"; locks: CollabLineLock[] }
	| { type: "media"; media: CollabSharedMedia[] }
	| { type: "pong"; at: number }
	| { type: "members"; members: CollabMember[]; waiting: CollabWaitingPeer[] }
	| { type: "comments"; comments: CollabComment[] }
	| { type: "review"; marks: CollabReviewMark[] }
	| { type: "splitDictionary"; splits: SharedSplitSuggestion[] }
	| {
			type: "history";
			history: CollabHistoryEntry[];
			restorePoints: CollabRestorePoint[];
	  }
	| { type: "invites"; invites: CollabInvite[] }
	| { type: "policy"; policy: RoomPolicy }
	| {
			type: "focus";
			from: string;
			name: string;
			color: string;
			lineId: string;
			wordId?: string;
			at: number;
	  }
	| { type: "snapshot"; snapshot: CollabSnapshot }
	| { type: "approved"; snapshot: CollabSnapshot; clientId?: string } & Partial<CollabRoomState>
	| { type: "waiting"; roomId: string }
	| { type: "kicked"; clientId: string; reason: string }
	| { type: "permission"; message: string }
	| { type: "error"; message: string };

export type CollabClientMessage =
	| {
			type: "patch";
			opId: string;
			seq: number;
			lines?: CollabLine[];
			removed?: string[];
			order?: string[];
			inserts?: CollabInsert[];
			project?: CollabProject;
			historyKind?: string;
			historySummary?: string;
			revertOf?: string;
	  }
	| { type: "chat"; text: string }
	| { type: "rename"; name: string }
	| { type: "lock"; lineIds: string[] }
	| { type: "ping"; at: number }
	| { type: "setRole"; clientId: string; role: CollabRole }
	| { type: "transferHost"; clientId: string }
	| {
			type: "inviteCreate";
			label?: string;
			password?: string;
			role: CollabRole;
			expiresInMs?: number | null;
			maxUses?: number | null;
			requireApproval?: boolean;
	  }
	| { type: "inviteRevoke"; inviteId: string }
	| { type: "kick"; clientId: string }
	| { type: "ban"; clientId: string }
	| { type: "lockRoom"; locked: boolean }
	| { type: "approve"; clientId: string }
	| { type: "deny"; clientId: string }
	| {
			type: "setPolicy";
			defaultRole?: CollabRole;
			editorsCanRollback?: boolean;
			approveJoiners?: boolean;
	  }
	| {
			type: "comment";
			action: "create" | "edit" | "delete" | "resolve";
			commentId?: string;
			lineId?: string;
			wordId?: string;
			parentId?: string;
			text?: string;
			resolved?: boolean;
	  }
	| {
			type: "reviewMark";
			lineId: string;
			status: "ok" | "needs-fix" | "unsure";
			note?: string;
	  }
	| {
			type: "shareSplit";
			id: string;
			wordKey: string;
			displayWord: string;
			boundaries: number[];
			label: string;
			note: string;
	  }
	| { type: "removeSharedSplit"; id: string }
	| { type: "focus"; lineId: string; wordId?: string }
	| { type: "restorePoint"; name: string }
	| { type: "restore"; restorePointId: string }
	| { type: "revert"; historyId: string };

/** The Jotai lyric state is the source of truth; this converts it to a room document. */
export function toCollabSnapshot(lyric: TTMLLyric): CollabSnapshot {
	const lines = lyric.lyricLines.map((line) => ({
		id: line.id,
		data: line,
	}));
	return {
		lines,
		order: lyric.lyricLines.map((line) => line.id),
		project: {
			metadata: lyric.metadata,
			marks: lyric.marks ?? [],
			sections: lyric.sections ?? [],
			songInfo: lyric.songInfo ?? null,
		},
	};
}

export function toCollabLyric(snapshot: CollabSnapshot): TTMLLyric {
	const project = snapshot.project ?? {
		metadata: [],
		marks: [],
		sections: [],
	};
	const lineById = new Map(snapshot.lines.map((line) => [line.id, line] as const));
	const ordered = (snapshot.order?.length ? snapshot.order : snapshot.lines.map((line) => line.id))
		.map((id) => lineById.get(id))
		.filter((line): line is CollabLine => Boolean(line));
	for (const line of snapshot.lines) {
		if (!ordered.some((candidate) => candidate.id === line.id)) ordered.push(line);
	}
	return {
		metadata: project.metadata ?? [],
		lyricLines: ordered.map((line) => ({
			...line.data,
			id: line.id,
		})),
		marks: project.marks ?? [],
		sections: project.sections ?? [],
		songInfo: project.songInfo ?? undefined,
	};
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Sends only changed lines and project fields. Different people editing different
 * lines merge naturally; edits to the same line use the last message received.
 */
export function diffCollabSnapshots(
	previous: CollabSnapshot,
	next: CollabSnapshot,
): CollabPatch | null {
	const previousLines = new Map(
		previous.lines.map((line) => [line.id, line.data]),
	);
	const nextLines = new Map(next.lines.map((line) => [line.id, line.data]));

	// Unchanged lines keep their object identity between snapshots. Comparing
	// references first avoids serializing the whole project on every keystroke
	// or remote patch, which is what made large rooms feel laggy.
	const changedLines = next.lines.filter((line) => {
		const previousLine = previousLines.get(line.id);
		return previousLine !== line.data && !sameJson(previousLine, line.data);
	});
	const removed = previous.lines
		.map((line) => line.id)
		.filter((id) => !nextLines.has(id));
	const orderChanged =
		previous.order !== next.order && !sameJson(previous.order, next.order);
	const projectRefsDiffer =
		previous.project.metadata !== next.project.metadata ||
		previous.project.marks !== next.project.marks ||
		previous.project.sections !== next.project.sections ||
		previous.project.songInfo !== next.project.songInfo;
	const projectChanged =
		projectRefsDiffer && !sameJson(previous.project, next.project);

	if (
		changedLines.length === 0 &&
		removed.length === 0 &&
		!orderChanged &&
		!projectChanged
	) {
		return null;
	}

	const newLineIds = next.order.filter((id) => !previousLines.has(id));
	const commonPreviousOrder = previous.order.filter((id) => nextLines.has(id));
	const commonNextOrder = next.order.filter((id) => previousLines.has(id));
	const insertionOnly = sameJson(commonPreviousOrder, commonNextOrder);
	const inserts: CollabInsert[] = [];
	if (insertionOnly) {
		for (const id of newLineIds) {
			const index = next.order.indexOf(id);
			inserts.push({
				id,
				afterId: index > 0 ? next.order[index - 1] : null,
			});
		}
	}

	return {
		...(changedLines.length > 0 ? { lines: changedLines } : {}),
		...(removed.length > 0 ? { removed } : {}),
		...(inserts.length > 0 ? { inserts } : {}),
		...(orderChanged && !insertionOnly ? { order: next.order } : {}),
		...(projectChanged ? { project: next.project } : {}),
	};
}

export function applyCollabPatch(
	current: TTMLLyric,
	patch: CollabPatch,
): TTMLLyric {
	const lines = new Map(
		current.lyricLines.map((line) => [line.id, line] as const),
	);

	for (const removedId of patch.removed ?? []) {
		lines.delete(removedId);
	}
	for (const line of patch.lines ?? []) {
		lines.set(line.id, { ...line.data, id: line.id });
	}

	const requestedOrder = patch.order ? [...patch.order] : current.lyricLines.map((line) => line.id);
	for (const line of patch.lines ?? []) {
		if (!requestedOrder.includes(line.id)) requestedOrder.push(line.id);
	}
	for (const insert of patch.inserts ?? []) {
		const existingIndex = requestedOrder.indexOf(insert.id);
		if (existingIndex >= 0) requestedOrder.splice(existingIndex, 1);
		const afterIndex = insert.afterId
			? requestedOrder.indexOf(insert.afterId)
			: -1;
		requestedOrder.splice(afterIndex + 1, 0, insert.id);
	}
	const orderedLines: LyricLine[] = [];
	const seen = new Set<string>();
	for (const id of requestedOrder) {
		const line = lines.get(id);
		if (line && !seen.has(id)) {
			orderedLines.push(line);
			seen.add(id);
		}
	}
	for (const [id, line] of lines) {
		if (!seen.has(id)) orderedLines.push(line);
	}

	const project = patch.project;
	return {
		...current,
		lyricLines: orderedLines,
		...(project
			? {
					metadata: project.metadata,
					marks: project.marks,
					sections: project.sections,
					songInfo: project.songInfo ?? current.songInfo,
				}
			: {}),
	};
}

export function getCollabRoomFromLocation(search: string): string | null {
	const room = new URLSearchParams(search).get("collabRoom");
	return room && /^[a-zA-Z0-9_-]{5,64}$/.test(room) ? room : null;
}

export interface CollabInviteLink {
	url: URL;
	room: string;
	inviteCode?: string;
}

/** Parse an invite shared by a host so the desktop app can join directly. */
export function parseCollabInviteLink(value: string): CollabInviteLink {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Paste the invite link from the host.");
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error(
			"That does not look like a room link. Paste the full link the host shared.",
		);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Room links must start with http:// or https://.");
	}

	const room = getCollabRoomFromLocation(url.search);
	if (!room) {
		throw new Error(
			"That link does not contain a collaboration room. Ask the host for a fresh invite link.",
		);
	}

	return {
		url,
		room,
		inviteCode: url.searchParams.get("invite") || undefined,
	};
}

export function buildGuestWebSocketUrl(
	location: Pick<Location, "protocol" | "host">,
	room: string,
	name: string,
	query?: URLSearchParams,
): string {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	const params = query ?? new URLSearchParams({ room, name });
	return `${protocol}//${location.host}/collab/ws?${params.toString()}`;
}

export function buildGuestSession(
	location: Pick<Location, "protocol" | "host" | "origin" | "hostname">,
	room: string,
): CollabSession {
	const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
	return {
		url: `${location.origin}/?collabRoom=${encodeURIComponent(room)}`,
		localUrl: `${location.origin}/?collabRoom=${encodeURIComponent(room)}`,
		wsUrl: `${wsProtocol}//${location.host}/collab/ws?room=${encodeURIComponent(room)}`,
		roomId: room,
		port: Number(location.host.split(":").pop()) || 0,
		lanIp: location.host.split(":")[0] ?? "",
		remote: location.hostname.endsWith(".trycloudflare.com"),
	};
}

export function sanitizeCollabName(name: string): string {
	const cleaned = [...name]
		.filter((character) => {
			const code = character.charCodeAt(0);
			return code > 31 && code !== 127;
		})
		.join("")
		.trim()
		.slice(0, 32);
	return cleaned || "Guest";
}

export function randomCollabName(): string {
	const adjectives = ["Swift", "Quiet", "Bright", "Neon", "Velvet", "Lucky"];
	const nouns = ["Comet", "Echo", "Fox", "Orbit", "Sparrow", "Cloud"];
	const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
	const noun = nouns[Math.floor(Math.random() * nouns.length)];
	return `${adjective} ${noun}`;
}

export function collabMediaUrl(
	session: Pick<CollabSession, "localUrl" | "roomId">,
	mediaId: string,
): string {
	const origin = new URL(session.localUrl).origin;
	return `${origin}/collab/media/${encodeURIComponent(mediaId)}?room=${encodeURIComponent(session.roomId)}`;
}

/** Newest song audio in a room; recordings are deliberately ignored. */
export function latestSharedAudio(
	media: CollabSharedMedia[],
): CollabSharedMedia | null {
	let latest: CollabSharedMedia | null = null;
	for (const item of media) {
		if (item.kind === "audio" && (!latest || item.at >= latest.at)) {
			latest = item;
		}
	}
	return latest;
}

export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(
		units.length - 1,
		Math.floor(Math.log(bytes) / Math.log(1024)),
	);
	const value = bytes / 1024 ** index;
	return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatChatTime(timestamp: number): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function peerInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	return words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}
