import type { Update } from "@tauri-apps/plugin-updater";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type UpdateStatus =
	| "idle"
	| "checking"
	| "up-to-date"
	| "available"
	| "downloading"
	| "ready"
	| "channel-unavailable"
	| "error";

export interface UpstreamReleaseInfo {
	version: string;
	url: string;
}

export const updateStatusAtom = atom<UpdateStatus>("idle");
export const updateInfoAtom = atom<Update | null>(null);
export const updateProgressAtom = atom<number>(0);
export const updateDownloadedBytesAtom = atom<number>(0);
export const updateTotalBytesAtom = atom<number>(0);
export const updateErrorAtom = atom<string>("");
export const upstreamReleaseAtom = atom<UpstreamReleaseInfo | null>(null);
export const updateDialogOpenAtom = atom(false);

export type UpdateChannel = "stable" | "beta";

export const autoUpdateCheckAtom = atomWithStorage(
	"appUpdateAutoCheck",
	true,
	undefined,
	{ getOnInit: true },
);
export const updateChannelAtom = atomWithStorage<UpdateChannel>(
	"appUpdateChannel",
	"stable",
	undefined,
	{ getOnInit: true },
);
export const skippedUpdateVersionAtom = atomWithStorage(
	"appUpdateSkippedVersion",
	"",
	undefined,
	{ getOnInit: true },
);
export const lastUpdateCheckAtom = atomWithStorage(
	"appUpdateLastCheck",
	0,
	undefined,
	{ getOnInit: true },
);
