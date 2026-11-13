import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ClipboardPayload, PasteMode } from "./types";

/** Survives reloads so a copied pattern is not lost to an accidental refresh. */
export const clipboardPayloadAtom = atomWithStorage<ClipboardPayload | null>(
	"amll_clipboard_payload_v1",
	null,
);

export interface TimingPasteDialogState {
	open: boolean;
	mode: PasteMode;
	targetLineId?: string;
	/** Preset for the "Paste as relative" command. */
	relative?: boolean;
}

export const timingPasteDialogAtom = atom<TimingPasteDialogState>({
	open: false,
	mode: "position",
});
