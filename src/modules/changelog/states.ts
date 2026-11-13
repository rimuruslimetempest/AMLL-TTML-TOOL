import { atomWithStorage } from "jotai/utils";

/** Automatically show What's New after the app version changes. */
export const whatsNewAutoOpenAtom = atomWithStorage(
	"whatsNewAutoOpen",
	true,
);

/** Last version whose What's New window was dismissed. */
export const whatsNewSeenVersionAtom = atomWithStorage(
	"whatsNewSeenVersion",
	"",
);
