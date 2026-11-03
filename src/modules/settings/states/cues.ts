import { atomWithStorage } from "jotai/utils";

/** Monitoring sounds played while the playhead crosses cue points. */
export type CueSound = "tick" | "click" | "beep" | "woodblock";

export const CUE_SOUNDS: readonly CueSound[] = [
	"tick",
	"click",
	"beep",
	"woodblock",
];

export type CueSource = "marks" | "sections" | "lines" | "words";

export const CUE_SOURCES: readonly CueSource[] = [
	"marks",
	"sections",
	"lines",
	"words",
];

// v2 keys: audible defaults (on, including word boundaries) without inheriting
// the silent defaults stored by earlier builds of this feature.
export const cuesEnabledAtom = atomWithStorage("cues.v2.enabled", true);

export const cueVolumeAtom = atomWithStorage("cues.v2.volume", 0.6);

export const cueSoundAtom = atomWithStorage<CueSound>("cues.v2.sound", "click");

export const cueSourcesAtom = atomWithStorage<CueSource[]>("cues.v2.sources", [
	"marks",
	"lines",
	"words",
]);

/** Keep cues silent in Preview mode unless this is on. */
export const cueInPreviewAtom = atomWithStorage("cues.v2.inPreview", false);

/** Cues closer together than this are merged so dense lyrics do not buzz. */
export const cueMinGapMsAtom = atomWithStorage("cues.v2.minGapMs", 60);
