import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { whatsNewDialogAtom } from "$/states/dialogs";
import { APP_VERSION } from "./data";
import {
	whatsNewAutoOpenAtom,
	whatsNewSeenVersionAtom,
} from "./states";

/**
 * Opens What's New once per app version. Closing the window records the
 * version, so it does not reappear on the next launch.
 */
export function ChangelogAutoOpen() {
	const autoOpen = useAtomValue(whatsNewAutoOpenAtom);
	const seenVersion = useAtomValue(whatsNewSeenVersionAtom);
	const setWhatsNewOpen = useSetAtom(whatsNewDialogAtom);

	useEffect(() => {
		if (!autoOpen || seenVersion === APP_VERSION) return;
		const timer = setTimeout(() => setWhatsNewOpen(true), 1200);
		return () => clearTimeout(timer);
	}, [autoOpen, seenVersion, setWhatsNewOpen]);

	return null;
}
