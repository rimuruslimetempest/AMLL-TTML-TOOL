import type { useStore } from "jotai";
import { uid } from "uid";
import { identifyProject } from "$/modules/project/logic/project-info";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import {
	activeWorkspaceTabAtom,
	crashRecoveryAtom,
	savedWorkspacesAtom,
	type SavedWorkspace,
	type SessionBackup,
	type SessionSnapshot,
	sessionReadyAtom,
	workspaceTabsAtom,
	type WorkspaceTab,
} from "$/modules/studio/state";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";

type StudioStore = ReturnType<typeof useStore>;

const SESSION_KEY = "ttml2SessionSnapshot";
const BACKUP_KEY = "ttml2SessionBackups";
const MAX_BACKUPS = 3;

export function serializeDocument(lyric: TTMLLyric): string {
	return exportTTMLText(lyric);
}

export function documentName(lyric: TTMLLyric, fileName: string): string {
	const identity = identifyProject(lyric);
	if (identity.displayName?.trim()) return identity.displayName;
	return fileName.replace(/\.[^.]+$/, "") || "Untitled";
}

export function emptyDocument(): TTMLLyric {
	return { lyricLines: [], metadata: [], marks: [], sections: [] };
}

export function syncActiveTab(store: StudioStore): void {
	const activeId = store.get(activeWorkspaceTabAtom);
	if (!activeId) return;
	const tabs = store.get(workspaceTabsAtom);
	const active = tabs.find((tab) => tab.id === activeId);
	if (!active) return;
	const lyric = store.get(lyricLinesAtom);
	const fileName = store.get(saveFileNameAtom);
	const dirty = store.get(isDirtyAtom);
	const ttml = serializeDocument(lyric);
	store.set(
		workspaceTabsAtom,
		tabs.map((tab) =>
			tab.id === activeId
				? {
						...tab,
						ttml,
						dirty,
						name: documentName(lyric, fileName),
						fileName,
						updatedAt: Date.now(),
					}
				: tab,
		),
	);
}

function upsertTab(store: StudioStore, tab: WorkspaceTab): void {
	const tabs = store.get(workspaceTabsAtom);
	const existing = tabs.find(
		(candidate) =>
			candidate.projectId === tab.projectId ||
			(candidate.fileName === tab.fileName && tab.fileName !== "unnamed.ttml"),
	);
	if (existing) {
		store.set(
			workspaceTabsAtom,
			tabs.map((candidate) =>
				candidate.id === existing.id ? { ...tab, id: existing.id } : candidate,
			),
		);
		store.set(activeWorkspaceTabAtom, existing.id);
		return;
	}
	store.set(workspaceTabsAtom, [...tabs, tab]);
	store.set(activeWorkspaceTabAtom, tab.id);
}

/** Records a document that was just opened or created in a workspace tab. */
export function registerWorkspaceTab(
	store: StudioStore,
	lyric: TTMLLyric,
	projectId: string,
	fileName: string,
): void {
	syncActiveTab(store);
	const tab: WorkspaceTab = {
		id: uid(),
		projectId,
		name: documentName(lyric, fileName),
		fileName,
		ttml: serializeDocument(lyric),
		dirty: false,
		updatedAt: Date.now(),
	};
	upsertTab(store, tab);
}

export function activateWorkspaceTab(
	store: StudioStore,
	tabId: string,
): string | null {
	const tabs = store.get(workspaceTabsAtom);
	const tab = tabs.find((candidate) => candidate.id === tabId);
	if (!tab) return "That tab is no longer available.";
	syncActiveTab(store);
	try {
		const lyric = parseLyric(tab.ttml);
		store.set(projectIdAtom, tab.projectId);
		store.set(newLyricLinesAtom, lyric);
		store.set(saveFileNameAtom, tab.fileName);
		store.set(activeWorkspaceTabAtom, tab.id);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

export function createBlankWorkspaceTab(store: StudioStore): void {
	syncActiveTab(store);
	const lyric = emptyDocument();
	const tab: WorkspaceTab = {
		id: uid(),
		projectId: uid(),
		name: "Untitled",
		fileName: "unnamed.ttml",
		ttml: serializeDocument(lyric),
		dirty: false,
		updatedAt: Date.now(),
	};
	store.set(workspaceTabsAtom, [...store.get(workspaceTabsAtom), tab]);
	store.set(activeWorkspaceTabAtom, tab.id);
	store.set(projectIdAtom, tab.projectId);
	store.set(newLyricLinesAtom, lyric);
	store.set(saveFileNameAtom, tab.fileName);
}

export function closeWorkspaceTab(store: StudioStore, tabId: string): void {
	syncActiveTab(store);
	const tabs = store.get(workspaceTabsAtom);
	const index = tabs.findIndex((tab) => tab.id === tabId);
	if (index < 0) return;
	const remaining = tabs.filter((tab) => tab.id !== tabId);
	store.set(workspaceTabsAtom, remaining);
	const activeId = store.get(activeWorkspaceTabAtom);
	if (activeId !== tabId) return;
	const next = remaining[index] ?? remaining[index - 1] ?? remaining[0];
	if (next) {
		activateWorkspaceTab(store, next.id);
	} else {
		createBlankWorkspaceTab(store);
	}
}

export function closeAllWorkspaceTabs(store: StudioStore): void {
	store.set(workspaceTabsAtom, []);
	store.set(activeWorkspaceTabAtom, null);
	createBlankWorkspaceTab(store);
}

// ---------------------------------------------------------------------------
// Session recovery
// ---------------------------------------------------------------------------

export function writeSessionSnapshot(store: StudioStore, clean: boolean): void {
	try {
		const snapshot: SessionSnapshot = {
			version: 2,
			savedAt: Date.now(),
			clean,
			tabs: store.get(workspaceTabsAtom),
			activeTabId: store.get(activeWorkspaceTabAtom),
			lyric: store.get(lyricLinesAtom),
			projectId: store.get(projectIdAtom),
			fileName: store.get(saveFileNameAtom),
		};
		localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
	} catch {
		// A full quota must never interrupt editing.
	}
}

export function readSessionSnapshot(): SessionSnapshot | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const value = JSON.parse(raw) as SessionSnapshot;
		if (value?.version !== 2 || !Array.isArray(value.tabs)) return null;
		return value;
	} catch {
		return null;
	}
}

export function detectInterruptedSession(store: StudioStore): void {
	const snapshot = readSessionSnapshot();
	store.set(sessionReadyAtom, true);
	if (!snapshot || snapshot.clean) return;
	const lyric = snapshot.lyric as TTMLLyric | undefined;
	const hasContent =
		(lyric?.lyricLines?.length ?? 0) > 0 || (lyric?.metadata?.length ?? 0) > 0;
	const activeTab = snapshot.tabs.find(
		(tab) => tab.id === snapshot.activeTabId,
	);
	const tabHasContent = Boolean(activeTab?.ttml && activeTab.ttml.length > 500);
	if (!hasContent && !tabHasContent) return;
	store.set(crashRecoveryAtom, snapshot);
}

export function restoreSessionSnapshot(
	store: StudioStore,
	snapshot: SessionSnapshot,
): void {
	if (snapshot.tabs.length > 0) {
		store.set(workspaceTabsAtom, snapshot.tabs);
	}
	if (snapshot.activeTabId) {
		const error = activateWorkspaceTab(store, snapshot.activeTabId);
		if (!error) {
			store.set(crashRecoveryAtom, null);
			writeSessionSnapshot(store, false);
			return;
		}
	}
	const lyric = snapshot.lyric as TTMLLyric | undefined;
	if (lyric?.lyricLines) {
		store.set(projectIdAtom, snapshot.projectId);
		store.set(newLyricLinesAtom, lyric);
		store.set(saveFileNameAtom, snapshot.fileName);
	}
	store.set(crashRecoveryAtom, null);
	writeSessionSnapshot(store, false);
}

export function markSessionClean(): void {
	const snapshot = readSessionSnapshot();
	if (!snapshot) return;
	try {
		localStorage.setItem(
			SESSION_KEY,
			JSON.stringify({ ...snapshot, clean: true }),
		);
	} catch {
		// ignore
	}
}

// ---------------------------------------------------------------------------
// Scheduled session backups and integrity checks
// ---------------------------------------------------------------------------

function checksum(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

export function readSessionBackups(): SessionBackup[] {
	try {
		const raw = localStorage.getItem(BACKUP_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as SessionBackup[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(backup) =>
				backup &&
				typeof backup.savedAt === "number" &&
				typeof backup.checksum === "string" &&
				backup.snapshot?.version === 2,
		);
	} catch {
		return [];
	}
}

export function verifySessionBackup(backup: SessionBackup): boolean {
	try {
		const payload = JSON.stringify(backup.snapshot);
		return checksum(payload) === backup.checksum;
	} catch {
		return false;
	}
}

export function writeSessionBackup(store: StudioStore): SessionBackup | null {
	try {
		const snapshot: SessionSnapshot = {
			version: 2,
			savedAt: Date.now(),
			clean: false,
			tabs: store.get(workspaceTabsAtom),
			activeTabId: store.get(activeWorkspaceTabAtom),
			lyric: store.get(lyricLinesAtom),
			projectId: store.get(projectIdAtom),
			fileName: store.get(saveFileNameAtom),
		};
		if (
			(snapshot.lyric as TTMLLyric).lyricLines.length === 0 &&
			snapshot.tabs.length === 0
		) {
			return null;
		}
		const payload = JSON.stringify(snapshot);
		const backup: SessionBackup = {
			id: uid(),
			savedAt: snapshot.savedAt,
			checksum: checksum(payload),
			size: payload.length,
			snapshot,
		};
		const existing = readSessionBackups().filter(
			(item) => item.checksum !== backup.checksum,
		);
		let next = [backup, ...existing].slice(0, MAX_BACKUPS);
		while (next.length > 1) {
			try {
				localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
				break;
			} catch {
				next = next.slice(0, Math.max(1, next.length - 1));
			}
		}
		if (next.length === 1) {
			try {
				localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
			} catch {
				return null;
			}
		}
		return backup;
	} catch {
		return null;
	}
}

export function getBackupStatus(): {
	savedAt: number | null;
	ok: boolean;
	size: number;
	count: number;
} {
	const backups = readSessionBackups();
	const latest = backups[0];
	return {
		savedAt: latest?.savedAt ?? null,
		ok: latest ? verifySessionBackup(latest) : false,
		size: latest?.size ?? 0,
		count: backups.length,
	};
}

// ---------------------------------------------------------------------------
// Portable workspace bundle
// ---------------------------------------------------------------------------

export async function exportPortableBundle(store: StudioStore): Promise<boolean> {
	const { buildBackup } = await import("$/modules/settings/backup/export");
	const { saveFile } = await import("$/utils/fileSystem");
	const backup = await buildBackup(
		new Set(["settings", "keybindings", "projects"] as const),
	);
	const payload = {
		app: "ttml-tool-portable",
		formatVersion: 1,
		exportedAt: new Date().toISOString(),
		backup,
		workspace: {
			tabs: store.get(workspaceTabsAtom),
			activeTabId: store.get(activeWorkspaceTabAtom),
			savedWorkspaces: store.get(savedWorkspacesAtom),
		},
		themes: localStorage.getItem("ttml_user_themes_v1"),
	};
	const saved = await saveFile(
		new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		}),
		{
			suggestedName: `ttml-tool-portable-${new Date().toISOString().slice(0, 10)}.json`,
			types: [
				{
					description: "TTML Tool portable workspace",
					accept: { "application/json": [".json"] },
				},
			],
		},
	);
	return Boolean(saved);
}

export async function importPortableBundle(
	store: StudioStore,
	file: File,
): Promise<string | null> {
	try {
		const payload = JSON.parse(await file.text()) as {
			app?: string;
			backup?: unknown;
			workspace?: {
				tabs?: WorkspaceTab[];
				activeTabId?: string | null;
				savedWorkspaces?: unknown;
			};
			themes?: string | null;
		};
		if (payload.app !== "ttml-tool-portable") {
			return "This is not a TTML Tool portable workspace file.";
		}
		const { parseBackupFile, getPresentCategories, applyBackup } = await import(
			"$/modules/settings/backup/import"
		);
		if (payload.backup) {
			const backupFile = parseBackupFile(JSON.stringify(payload.backup));
			await applyBackup(backupFile, new Set(getPresentCategories(backupFile)));
		}
		if (Array.isArray(payload.workspace?.tabs)) {
			store.set(workspaceTabsAtom, payload.workspace.tabs);
		}
		if (payload.workspace?.activeTabId) {
			store.set(activeWorkspaceTabAtom, payload.workspace.activeTabId);
		}
		if (Array.isArray(payload.workspace?.savedWorkspaces)) {
			store.set(
				savedWorkspacesAtom,
				payload.workspace.savedWorkspaces as SavedWorkspace[],
			);
		}
		if (typeof payload.themes === "string") {
			localStorage.setItem("ttml_user_themes_v1", payload.themes);
		}
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
