import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { QualityPreference } from "./quality";

/**
 * Visual quality is a separate axis from Performance mode: it only removes
 * decoration, while Performance mode also flattens chrome throughout the app.
 */
export const previewQualityAtom = atomWithStorage<QualityPreference>(
	"previewQuality",
	"auto",
);

/** Runtime level chosen by the controller; intentionally not persisted. */
export const previewQualityLevelAtom = atom(0);

export type PreviewFrameRateMode = "match" | "unlimited";

/**
 * "Unlimited" is experimental and needs a restart: it changes the WebView2
 * process arguments before the webview exists. Default stays Match display.
 */
export const previewFrameRateModeAtom =
	atomWithStorage<PreviewFrameRateMode>("previewFrameRateMode", "match");
