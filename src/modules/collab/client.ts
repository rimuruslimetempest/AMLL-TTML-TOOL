import { invoke, isTauri } from "@tauri-apps/api/core";
import type { TTMLLyric } from "$/types/ttml";
import { lyricLinesAtom, ToolMode, toolModeAtom } from "$/states/main";
import { globalStore } from "$/states/store";
import { audioPlayingAtom } from "$/modules/audio/states";
import {
	applyCollabPatch,
	buildGuestSession,
	buildGuestWebSocketUrl,
	diffCollabSnapshots,
	parseCollabInviteLink,
	sanitizeCollabName,
	shouldHoldRemoteEdits,
	toCollabLyric,
	toCollabSnapshot,
	type CollabClientMessage,
	type CollabServerMessage,
	type CollabSession,
	type CollabSnapshot,
} from "./logic";
import {
	can,
	denialMessage,
	type CollabPermission,
	type CollabRole,
} from "./permissions";
import {
	collabChatAtom,
	collabChatOpenAtom,
	collabCommentsAtom,
	collabErrorAtom,
	collabFollowAtom,
	collabGuestKeyAtom,
	collabHistoryAtom,
	collabInteractionAtom,
	collabInvitesAtom,
	collabKickedAtom,
	collabLatencyAtom,
	collabLocksAtom,
	collabMediaAtom,
	collabMembersAtom,
	collabNameAtom,
	collabPauseIncomingAtom,
	collabPeerFocusAtom,
	collabPeersAtom,
	collabPendingJoinAtom,
	collabPermissionNoticeAtom,
	collabPolicyAtom,
	collabQueuedChangesAtom,
	collabRemoteNoticeAtom,
	collabRemoteEditAtAtom,
	collabRestorePointsAtom,
	collabReviewMarksAtom,
	collabRoleAtom,
	collabSelfIdAtom,
	collabSessionAtom,
	collabSplitDictionaryAtom,
	collabStatusAtom,
	collabUnreadAtom,
	collabWaitingAtom,
} from "./states";

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown collaboration error.";
}

export interface JoinOptions {
	inviteCode?: string;
	password?: string;
	/** The host link when joining from inside the desktop app. */
	roomUrl?: URL;
}

class CollabClient {
	private socket: WebSocket | null = null;
	private active = false;
	private ready = false;
	private welcomed = false;
	private role: CollabRole | null = null;
	private wsUrl: string | null = null;
	private name = "Guest";
	private clientId = "";
	private lastSynced: CollabSnapshot | null = null;
	private applyingRemote = false;
	private unsubscribe: (() => void) | null = null;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private seq = 0;
	private remoteQueue: Extract<CollabServerMessage, { type: "patch" }>[] = [];
	private releaseSubscriptions: Array<() => void> = [];
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private lockTimer: ReturnType<typeof setInterval> | null = null;
	private activeLineId: string | null = null;
	private lockLeaseUntil = 0;
	private focusTimer: ReturnType<typeof setTimeout> | null = null;

	async startHost(name: string, remote: boolean): Promise<CollabSession> {
		if (!isTauri()) {
			throw new Error("Hosting is available in the desktop app.");
		}
		if (this.active) {
			throw new Error("Leave the current room before starting another one.");
		}

		const cleanName = sanitizeCollabName(name);
		globalStore.set(collabNameAtom, cleanName);
		globalStore.set(collabErrorAtom, null);
		globalStore.set(collabStatusAtom, "starting");
		globalStore.set(collabPauseIncomingAtom, false);
		this.role = "host";
		globalStore.set(collabRoleAtom, "host");

		try {
			const snapshot = toCollabSnapshot(globalStore.get(lyricLinesAtom));
			const session = await invoke<CollabSession>(
				"start_collab_server",
				{ snapshot, remote },
			);
			globalStore.set(collabSessionAtom, session);
			this.welcomed = false;
			this.reconnectAttempt = 0;
			const hostUrl = new URL(session.wsUrl);
			hostUrl.searchParams.set("name", cleanName);
			this.connect(hostUrl.toString(), cleanName);
			return session;
		} catch (error) {
			const message = errorMessage(error);
			globalStore.set(collabErrorAtom, message);
			globalStore.set(collabStatusAtom, "error");
			globalStore.set(collabRoleAtom, null);
			this.role = null;
			throw error;
		}
	}

	joinGuest(
		room: string,
		name: string,
		options: JoinOptions = {},
	): CollabSession {
		if (this.active) {
			throw new Error("Leave the current room before joining another one.");
		}
		const base = options.roomUrl ?? window.location;
		const cleanName = sanitizeCollabName(name);
		const session = buildGuestSession(base, room);
		globalStore.set(collabNameAtom, cleanName);
		globalStore.set(collabErrorAtom, null);
		globalStore.set(collabSessionAtom, session);
		globalStore.set(collabRoleAtom, "viewer");
		globalStore.set(collabPauseIncomingAtom, false);
		globalStore.set(collabPendingJoinAtom, false);
		globalStore.set(collabKickedAtom, null);
		this.role = "viewer";
		this.welcomed = false;
		this.reconnectAttempt = 0;
		const params = new URLSearchParams({
			room,
			name: cleanName,
			key: globalStore.get(collabGuestKeyAtom),
		});
		if (options.inviteCode) params.set("invite", options.inviteCode);
		if (options.password) params.set("password", options.password);
		this.connect(
			buildGuestWebSocketUrl(base, room, cleanName, params),
			cleanName,
		);
		return session;
	}

	/** Join a host link directly from TTML Tool instead of opening its web room. */
	joinGuestFromLink(
		link: string,
		name: string,
		options: Omit<JoinOptions, "roomUrl"> = {},
	): CollabSession {
		try {
			const target = parseCollabInviteLink(link);
			return this.joinGuest(target.room, name, {
				...options,
				inviteCode: options.inviteCode?.trim() || target.inviteCode,
				roomUrl: target.url,
			});
		} catch (error) {
			const message = errorMessage(error);
			globalStore.set(collabErrorAtom, message);
			globalStore.set(collabStatusAtom, "error");
			throw error;
		}
	}

	private connect(wsUrl: string, name: string): void {
		this.active = true;
		this.ready = false;
		this.name = name;
		this.wsUrl = wsUrl;
		this.clearReconnect();
		this.detachSocket();
		globalStore.set(collabErrorAtom, null);
		globalStore.set(collabStatusAtom, "connecting");
		globalStore.set(collabLatencyAtom, null);
		this.lastSynced = toCollabSnapshot(globalStore.get(lyricLinesAtom));

		let socket: WebSocket;
		try {
			socket = new WebSocket(wsUrl);
		} catch (error) {
			this.handleConnectionFailure(errorMessage(error));
			return;
		}
		this.socket = socket;

		socket.onopen = () => {
			if (this.socket !== socket) return;
			globalStore.set(collabErrorAtom, null);
			globalStore.set(collabStatusAtom, "connecting");
		};

		socket.onmessage = (event) => {
			if (this.socket !== socket) return;
			this.handleMessage(event.data);
		};

		socket.onerror = () => {
			if (this.socket !== socket || !this.active) return;
			// `onclose` performs the actual retry. Keeping the status as reconnecting
			// avoids showing a scary error for a single transient packet.
			globalStore.set(collabStatusAtom, "reconnecting");
		};

		socket.onclose = () => {
			if (this.socket !== socket) return;
			this.socket = null;
			if (!this.active) return;
			if (!this.welcomed && this.reconnectAttempt >= 2) {
				this.active = false;
				this.ready = false;
				this.clearReconnect();
				globalStore.set(
					collabErrorAtom,
					"Could not reach the host. Check that the link is correct, the invite has not expired, and the host app is still open.",
				);
				globalStore.set(collabStatusAtom, "error");
				globalStore.set(collabLatencyAtom, null);
				globalStore.set(collabLocksAtom, []);
				return;
			}
			globalStore.set(collabStatusAtom, "reconnecting");
			globalStore.set(collabLatencyAtom, null);
			globalStore.set(collabLocksAtom, []);
			this.scheduleReconnect();
		};

		this.unsubscribe?.();
		this.unsubscribe = globalStore.sub(lyricLinesAtom, () => {
			this.handleLocalChange();
		});
		this.clearSubscriptions();
		this.releaseSubscriptions.push(
			globalStore.sub(audioPlayingAtom, () => this.flushRemoteQueue()),
			globalStore.sub(collabInteractionAtom, () => this.flushRemoteQueue()),
			globalStore.sub(collabPauseIncomingAtom, () => this.flushRemoteQueue()),
		);
		this.startPing();
	}

	private handleMessage(raw: string): void {
		let message: CollabServerMessage;
		try {
			message = JSON.parse(raw) as CollabServerMessage;
		} catch {
			return;
		}

		switch (message.type) {
			case "welcome": {
				this.clientId = message.clientId;
				this.ready = true;
				globalStore.set(collabSelfIdAtom, message.clientId);
				this.welcomed = true;
				this.reconnectAttempt = 0;
				globalStore.set(collabPendingJoinAtom, false);
				globalStore.set(collabRoleAtom, message.role);
				this.role = message.role;
				this.applyRemoteLyric(toCollabLyric(message.snapshot));
				globalStore.set(collabPeersAtom, message.peers);
				globalStore.set(collabMembersAtom, message.members);
				globalStore.set(collabWaitingAtom, message.waiting);
				globalStore.set(collabChatAtom, message.chat);
				globalStore.set(collabMediaAtom, message.media ?? []);
				globalStore.set(collabLocksAtom, message.locks ?? []);
				globalStore.set(collabCommentsAtom, message.comments);
				globalStore.set(collabReviewMarksAtom, message.reviewMarks);
				globalStore.set(
					collabSplitDictionaryAtom,
					message.splitDictionary ?? [],
				);
				globalStore.set(collabHistoryAtom, message.history);
				globalStore.set(collabRestorePointsAtom, message.restorePoints);
				globalStore.set(collabInvitesAtom, message.invites);
				globalStore.set(collabPolicyAtom, message.policy);
				globalStore.set(collabStatusAtom, "connected");
				globalStore.set(collabErrorAtom, null);
				this.remoteQueue = [];
				globalStore.set(collabQueuedChangesAtom, 0);
				if (this.activeLineId && this.lockLeaseUntil > Date.now()) {
					this.sendLineLock();
				} else {
					this.clearLineLock();
				}
				break;
			}
			case "approved": {
				this.clientId = message.clientId ?? this.clientId;
				if (message.clientId) {
					globalStore.set(collabSelfIdAtom, message.clientId);
				}
				this.welcomed = true;
				this.ready = true;
				globalStore.set(collabPendingJoinAtom, false);
				if (message.role) {
					this.role = message.role;
					globalStore.set(collabRoleAtom, message.role);
				}
				this.applyRemoteLyric(toCollabLyric(message.snapshot));
				if (message.members) globalStore.set(collabMembersAtom, message.members);
				if (message.waiting) globalStore.set(collabWaitingAtom, message.waiting);
				if (message.comments) globalStore.set(collabCommentsAtom, message.comments);
				if (message.reviewMarks) {
					globalStore.set(collabReviewMarksAtom, message.reviewMarks);
				}
				if (message.splitDictionary) {
					globalStore.set(
						collabSplitDictionaryAtom,
						message.splitDictionary,
					);
				}
				if (message.history) globalStore.set(collabHistoryAtom, message.history);
				if (message.restorePoints) {
					globalStore.set(collabRestorePointsAtom, message.restorePoints);
				}
				if (message.policy) globalStore.set(collabPolicyAtom, message.policy);
				globalStore.set(collabStatusAtom, "connected");
				break;
			}
			case "waiting": {
				globalStore.set(collabPendingJoinAtom, true);
				globalStore.set(collabRoleAtom, "viewer");
				this.role = "viewer";
				globalStore.set(collabStatusAtom, "connected");
				break;
			}
			case "patch": {
				// The server sends our patch back to us. Applying that echo over local
				// state is what made a timestamp snap back during a drag.
				if (message.from === this.clientId) break;
				if (this.shouldBufferRemote()) {
					this.remoteQueue.push(message);
					globalStore.set(collabQueuedChangesAtom, this.remoteQueue.length);
					break;
				}
				this.applyRemotePatch(message);
				break;
			}
			case "snapshot": {
				this.applyRemoteLyric(toCollabLyric(message.snapshot));
				break;
			}
			case "pong": {
				globalStore.set(
					collabLatencyAtom,
					Math.max(0, Date.now() - message.at),
				);
				break;
			}
			case "chat": {
				this.appendChat(message.message);
				break;
			}
			case "peers": {
				globalStore.set(collabPeersAtom, message.peers);
				break;
			}
			case "locks": {
				globalStore.set(collabLocksAtom, message.locks);
				break;
			}
			case "media": {
				globalStore.set(collabMediaAtom, message.media);
				break;
			}
			case "members": {
				globalStore.set(collabMembersAtom, message.members);
				globalStore.set(collabWaitingAtom, message.waiting);
				break;
			}
			case "comments": {
				globalStore.set(collabCommentsAtom, message.comments);
				break;
			}
			case "review": {
				globalStore.set(collabReviewMarksAtom, message.marks);
				break;
			}
			case "splitDictionary": {
				globalStore.set(collabSplitDictionaryAtom, message.splits);
				break;
			}
			case "history": {
				globalStore.set(collabHistoryAtom, message.history);
				globalStore.set(collabRestorePointsAtom, message.restorePoints);
				break;
			}
			case "invites": {
				globalStore.set(collabInvitesAtom, message.invites);
				break;
			}
			case "policy": {
				globalStore.set(collabPolicyAtom, message.policy);
				break;
			}
			case "focus": {
				globalStore.set(collabPeerFocusAtom, {
					from: message.from,
					name: message.name,
					color: message.color,
					lineId: message.lineId,
					wordId: message.wordId,
					at: message.at,
				});
				break;
			}
			case "permission": {
				globalStore.set(collabPermissionNoticeAtom, message.message);
				break;
			}
			case "kicked": {
				if (message.clientId !== this.clientId) break;
				globalStore.set(collabKickedAtom, message.reason);
				globalStore.set(collabErrorAtom, message.reason);
				this.active = false;
				this.ready = false;
				this.welcomed = false;
				this.clearReconnect();
				this.detachSocket();
				globalStore.set(collabStatusAtom, "idle");
				globalStore.set(collabRoleAtom, null);
				globalStore.set(collabMembersAtom, []);
				globalStore.set(collabPeersAtom, []);
				globalStore.set(collabLocksAtom, []);
				globalStore.set(collabSplitDictionaryAtom, []);
				break;
			}
			case "error": {
				globalStore.set(collabErrorAtom, message.message);
				if (message.message.includes("changed too quickly")) {
					globalStore.set(collabStatusAtom, "reconnecting");
					this.socket?.close();
				} else {
					this.active = false;
					this.ready = false;
					globalStore.set(collabStatusAtom, "error");
					this.socket?.close();
				}
				break;
			}
		}
	}

	private shouldBufferRemote(): boolean {
		return shouldHoldRemoteEdits({
			paused: globalStore.get(collabPauseIncomingAtom),
			interacting: globalStore.get(collabInteractionAtom) !== null,
			syncing: globalStore.get(toolModeAtom) === ToolMode.Sync,
			playing: globalStore.get(audioPlayingAtom),
		});
	}

	private applyRemoteLyric(lyric: TTMLLyric): void {
		this.applyingRemote = true;
		try {
			globalStore.set(lyricLinesAtom, lyric);
		} finally {
			this.applyingRemote = false;
		}
		this.lastSynced = toCollabSnapshot(globalStore.get(lyricLinesAtom));
	}

	private applyRemotePatches(
		messages: Extract<CollabServerMessage, { type: "patch" }>[],
	): void {
		if (messages.length === 0) return;
		const current = globalStore.get(lyricLinesAtom);
		const next = messages.reduce(
			(lyric, message) => applyCollabPatch(lyric, message),
			current,
		);
		this.applyingRemote = true;
		try {
			this.lastSynced = toCollabSnapshot(next);
			globalStore.set(collabRemoteEditAtAtom, Date.now());
			globalStore.set(lyricLinesAtom, next);
		} finally {
			this.applyingRemote = false;
		}
	}

	private applyRemotePatch(
		message: Extract<CollabServerMessage, { type: "patch" }>,
	): void {
		this.applyRemotePatches([message]);
	}

	private flushRemoteQueue(): void {
		if (!this.ready || this.remoteQueue.length === 0) return;
		if (this.shouldBufferRemote()) return;
		const count = this.remoteQueue.length;
		const queued = this.remoteQueue;
		this.remoteQueue = [];
		this.applyRemotePatches(queued);
		globalStore.set(collabQueuedChangesAtom, 0);
		globalStore.set(collabRemoteNoticeAtom, { count, at: Date.now() });
	}

	private startPing(): void {
		if (this.pingTimer) clearInterval(this.pingTimer);
		const ping = () => {
			if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
			this.socket.send(JSON.stringify({ type: "ping", at: Date.now() }));
		};
		ping();
		this.pingTimer = setInterval(ping, 5000);
	}

	private clearSubscriptions(): void {
		for (const release of this.releaseSubscriptions) release();
		this.releaseSubscriptions = [];
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}

	private appendChat(message: Extract<CollabServerMessage, { type: "chat" }>["message"]): void {
		const current = globalStore.get(collabChatAtom);
		globalStore.set(collabChatAtom, [...current, message].slice(-250));
		if (
			message.authorId !== this.clientId &&
			!globalStore.get(collabChatOpenAtom)
		) {
			globalStore.set(collabUnreadAtom, globalStore.get(collabUnreadAtom) + 1);
		}
	}

	private handleLocalChange(): void {
		if (!this.active || !this.ready) return;
		// Server-applied updates already updated lastSynced; diffing them again
		// would schedule a pointless flush for every remote patch.
		if (this.applyingRemote) return;
		// Client-side enforcement: a viewer or commenter can still click a
		// control, but the room copy must not drift from the server. Restore the
		// last synced snapshot and explain the denial. Server-side checks remain
		// authoritative for modified clients.
		if (this.lastSynced && this.role && !can(this.role, "editLyrics")) {
			const current = toCollabSnapshot(globalStore.get(lyricLinesAtom));
			if (diffCollabSnapshots(this.lastSynced, current)) {
				globalStore.set(lyricLinesAtom, toCollabLyric(this.lastSynced));
				globalStore.set(
					collabPermissionNoticeAtom,
					denialMessage(this.role, "editLyrics"),
				);
			}
			return;
		}
		if (this.flushTimer) clearTimeout(this.flushTimer);
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			this.flushLocalChanges();
		}, 90);
	}

	private flushLocalChanges(): void {
		if (!this.active || !this.ready || !this.lastSynced) return;
		const socket = this.socket;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		// Server-side enforcement is authoritative, but a viewer should never
		// quietly overwrite the room either. Their local copy simply stays local
		// until they are promoted.
		if (this.role && !can(this.role, "editLyrics")) return;

		const current = toCollabSnapshot(globalStore.get(lyricLinesAtom));
		const patch = diffCollabSnapshots(this.lastSynced, current);
		if (!patch) return;

		this.seq += 1;
		const message: CollabClientMessage = {
			type: "patch",
			opId: crypto.randomUUID(),
			seq: this.seq,
			...patch,
		};
		try {
			socket.send(JSON.stringify(message));
			this.lastSynced = current;
		} catch (error) {
			globalStore.set(collabErrorAtom, errorMessage(error));
		}
	}

	/**
	 * Returns true when the local role allows the action. Otherwise sets a
	 * friendly, role-aware notice for the UI and returns false.
	 */
	guard(permission: CollabPermission): boolean {
		const role = this.role;
		if (can(role, permission, globalStore.get(collabPolicyAtom))) return true;
		globalStore.set(
			collabPermissionNoticeAtom,
			denialMessage(role, permission),
		);
		return false;
	}

	notify(permission: CollabPermission): void {
		this.guard(permission);
	}

	private send(message: CollabClientMessage): boolean {
		if (!this.ready || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		this.socket.send(JSON.stringify(message));
		return true;
	}

	/** Broadcast the line (and word) the local user is working on for follow mode. */
	announceFocus(lineId: string, wordId?: string): void {
		if (!this.ready || !this.active) return;
		if (this.focusTimer) clearTimeout(this.focusTimer);
		this.focusTimer = setTimeout(() => {
			this.focusTimer = null;
			this.send({ type: "focus", lineId, wordId });
		}, 120);
	}

	acquireLineLock(lineId: string): void {
		if (!this.active) return;
		if (this.activeLineId === lineId && this.lockLeaseUntil > Date.now()) {
			this.touchLineLock();
			return;
		}
		this.activeLineId = lineId;
		this.lockLeaseUntil = Date.now() + 20_000;
		if (!this.lockTimer) {
			this.lockTimer = setInterval(() => {
				if (!this.activeLineId) return;
				if (this.lockLeaseUntil <= Date.now()) {
					this.clearLineLock();
					return;
				}
				this.sendLineLock();
			}, 5000);
		}
		this.sendLineLock();
	}

	touchLineLock(): void {
		if (this.activeLineId) this.lockLeaseUntil = Date.now() + 20_000;
	}

	private sendLineLock(): void {
		if (!this.ready) return;
		this.send({
			type: "lock",
			lineIds: this.activeLineId ? [this.activeLineId] : [],
		});
	}

	private clearLineLock(): void {
		this.activeLineId = null;
		this.lockLeaseUntil = 0;
		if (this.lockTimer) {
			clearInterval(this.lockTimer);
			this.lockTimer = null;
		}
		this.sendLineLock();
	}

	shareSplit(suggestion: {
		id: string;
		wordKey: string;
		displayWord: string;
		boundaries: number[];
		label: string;
		note: string;
	}): boolean {
		if (!this.guard("addRoomSplit")) return false;
		return this.send({ type: "shareSplit", ...suggestion });
	}

	removeSharedSplit(id: string): boolean {
		if (!this.guard("removeRoomSplit")) return false;
		return this.send({ type: "removeSharedSplit", id });
	}

	sendChat(text: string): void {
		const trimmed = text.trim();
		if (!trimmed) return;
		this.send({ type: "chat", text: trimmed });
	}

	rename(name: string): void {
		const cleanName = sanitizeCollabName(name);
		this.name = cleanName;
		globalStore.set(collabNameAtom, cleanName);
		this.send({ type: "rename", name: cleanName });
	}

	setRole(clientId: string, role: CollabRole): boolean {
		if (!this.guard("manageRoles")) return false;
		return this.send({ type: "setRole", clientId, role });
	}

	transferHost(clientId: string): boolean {
		if (!this.guard("transferHost")) return false;
		return this.send({ type: "transferHost", clientId });
	}

	createInvite(options: {
		label?: string;
		password?: string;
		role: CollabRole;
		expiresInMs?: number | null;
		maxUses?: number | null;
		requireApproval?: boolean;
	}): boolean {
		if (!this.guard("manageInvites")) return false;
		return this.send({ type: "inviteCreate", ...options });
	}

	revokeInvite(inviteId: string): boolean {
		if (!this.guard("manageInvites")) return false;
		return this.send({ type: "inviteRevoke", inviteId });
	}

	kick(clientId: string): boolean {
		if (!this.guard("kick")) return false;
		return this.send({ type: "kick", clientId });
	}

	ban(clientId: string): boolean {
		if (!this.guard("kick")) return false;
		return this.send({ type: "ban", clientId });
	}

	lockRoom(locked: boolean): boolean {
		if (!this.guard("lockRoom")) return false;
		return this.send({ type: "lockRoom", locked });
	}

	approve(clientId: string): boolean {
		if (!this.guard("manageInvites")) return false;
		return this.send({ type: "approve", clientId });
	}

	deny(clientId: string): boolean {
		if (!this.guard("manageInvites")) return false;
		return this.send({ type: "deny", clientId });
	}

	updatePolicy(policy: {
		defaultRole?: CollabRole;
		editorsCanRollback?: boolean;
		approveJoiners?: boolean;
	}): boolean {
		if (!this.guard("manageRoles")) return false;
		return this.send({ type: "setPolicy", ...policy });
	}

	comment(
		action: "create" | "edit" | "delete" | "resolve",
		payload: {
			commentId?: string;
			lineId?: string;
			wordId?: string;
			parentId?: string;
			text?: string;
			resolved?: boolean;
		},
	): boolean {
		if (!this.guard(action === "create" ? "comment" : "comment")) {
			return false;
		}
		return this.send({ type: "comment", action, ...payload });
	}

	reviewMark(
		lineId: string,
		status: "ok" | "needs-fix" | "unsure",
		note?: string,
	): boolean {
		if (!this.guard("review")) return false;
		return this.send({ type: "reviewMark", lineId, status, note });
	}

	createRestorePoint(name: string): boolean {
		if (!this.guard("rollback")) return false;
		return this.send({ type: "restorePoint", name });
	}

	restoreRestorePoint(restorePointId: string): boolean {
		if (!this.guard("rollback")) return false;
		return this.send({ type: "restore", restorePointId });
	}

	revertHistory(historyId: string): boolean {
		if (!this.guard("rollback")) return false;
		return this.send({ type: "revert", historyId });
	}

	stopFollowing(): void {
		globalStore.set(collabFollowAtom, null);
	}

	retry(): void {
		if (!this.wsUrl) return;
		this.active = true;
		this.welcomed = false;
		this.reconnectAttempt = 0;
		this.clearReconnect();
		this.connect(this.wsUrl, this.name);
	}

	stop(): void {
		const wasHost = this.role === "host";
		this.clearLineLock();
		this.active = false;
		this.ready = false;
		this.welcomed = false;
		this.clearReconnect();
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		if (this.focusTimer) {
			clearTimeout(this.focusTimer);
			this.focusTimer = null;
		}
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.clearSubscriptions();
		this.detachSocket();
		this.lastSynced = null;
		this.role = null;
		this.wsUrl = null;
		this.clientId = "";
		this.remoteQueue = [];
		this.seq = 0;
		globalStore.set(collabRoleAtom, null);
		globalStore.set(collabSessionAtom, null);
		globalStore.set(collabStatusAtom, "idle");
		globalStore.set(collabErrorAtom, null);
		globalStore.set(collabPeersAtom, []);
		globalStore.set(collabMembersAtom, []);
		globalStore.set(collabWaitingAtom, []);
		globalStore.set(collabInvitesAtom, []);
		globalStore.set(collabHistoryAtom, []);
		globalStore.set(collabRestorePointsAtom, []);
		globalStore.set(collabChatAtom, []);
		globalStore.set(collabMediaAtom, []);
		globalStore.set(collabUnreadAtom, 0);
		globalStore.set(collabLatencyAtom, null);
		globalStore.set(collabSelfIdAtom, "");
		globalStore.set(collabLocksAtom, []);
		globalStore.set(collabPauseIncomingAtom, false);
		globalStore.set(collabQueuedChangesAtom, 0);
		globalStore.set(collabRemoteNoticeAtom, null);
		globalStore.set(collabFollowAtom, null);
		globalStore.set(collabPeerFocusAtom, null);
		globalStore.set(collabPendingJoinAtom, false);
		globalStore.set(collabPermissionNoticeAtom, null);
		if (wasHost && isTauri()) {
			void invoke("stop_collab_server").catch(() => {});
		}
	}

	private detachSocket(): void {
		const socket = this.socket;
		this.socket = null;
		if (!socket) return;
		socket.onopen = null;
		socket.onmessage = null;
		socket.onerror = null;
		socket.onclose = null;
		try {
			socket.close();
		} catch {}
	}

	private scheduleReconnect(): void {
		if (!this.active || this.reconnectTimer) return;
		const delay = Math.min(5000, 900 * 2 ** this.reconnectAttempt);
		this.reconnectAttempt += 1;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (this.active && this.wsUrl) {
				this.connect(this.wsUrl, this.name);
			}
		}, delay);
	}

	private clearReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private handleConnectionFailure(message: string): void {
		this.active = false;
		this.ready = false;
		globalStore.set(collabErrorAtom, message);
		globalStore.set(collabStatusAtom, "error");
	}
}

export const collabClient = new CollabClient();
