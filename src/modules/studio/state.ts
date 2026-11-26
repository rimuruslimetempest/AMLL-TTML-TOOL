import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface WorkspaceTab {
	id: string;
	projectId: string;
	name: string;
	fileName: string;
	ttml: string;
	dirty: boolean;
	updatedAt: number;
}

export interface ReviewComment {
	id: string;
	issueId: string;
	author: string;
	body: string;
	createdAt: number;
}

export interface SavedWorkspace {
	id: string;
	name: string;
	layoutOrder: string[];
	ribbonPosition: "top" | "bottom" | "left" | "right";
	createdAt: number;
}

export interface SessionSnapshot {
	version: 2;
	savedAt: number;
	clean: boolean;
	tabs: WorkspaceTab[];
	activeTabId: string | null;
	lyric: unknown;
	projectId: string;
	fileName: string;
}

export interface SessionBackup {
	id: string;
	savedAt: number;
	checksum: string;
	size: number;
	snapshot: SessionSnapshot;
}

export interface DiffRequest {
	leftTitle: string;
	leftText: string;
	rightTitle: string;
	rightText: string;
}

export const workspaceHomeOpenAtom = atom(false);
export const commandPaletteOpenAtom = atom(false);
export const reviewCockpitOpenAtom = atom(false);
export const themeStudioOpenAtom = atom(false);
export const workspaceManagerOpenAtom = atom(false);
export const pluginStudioOpenAtom = atom(false);
export const diffDialogAtom = atom<DiffRequest | null>(null);

export const workspaceTabsAtom = atomWithStorage<WorkspaceTab[]>(
	"ttml2WorkspaceTabs",
	[],
);
export const activeWorkspaceTabAtom = atomWithStorage<string | null>(
	"ttml2ActiveWorkspaceTab",
	null,
);
export const savedWorkspacesAtom = atomWithStorage<SavedWorkspace[]>(
	"ttml2SavedWorkspaces",
	[],
);
export const focusModeAtom = atomWithStorage<boolean>("ttml2FocusMode", false);

export const reviewResolvedAtom = atomWithStorage<Record<string, string[]>>(
	"ttml2ReviewResolved",
	{},
);
export const reviewCommentsAtom = atomWithStorage<
	Record<string, ReviewComment[]>
>("ttml2ReviewComments", {});

export const crashRecoveryAtom = atom<SessionSnapshot | null>(null);
export const sessionReadyAtom = atom(false);
export const lastBackupInfoAtom = atom<{
	savedAt: number;
	ok: boolean;
	size: number;
} | null>(null);

export const portableModeAtom = atomWithStorage<boolean>("ttml2PortableMode", false);

export const interfaceDirectionAtom = atomWithStorage<"auto" | "ltr" | "rtl">(
	"ttml2InterfaceDirection",
	"auto",
);

export const reviewScopeAtom = atomWithStorage<"project" | "library">(
	"ttml2ReviewScope",
	"project",
);

export const studioNoticeAtom = atom<string | null>(null);
