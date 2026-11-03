import { useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states";
import { toggleMarkAt } from "$/modules/project/logic/marks";
import { keyAddCueAtPlayheadAtom } from "$/states/keybindings";
import { lyricLinesAtom } from "$/states/main";
import { useKeyBindingAtom } from "$/utils/keybindings";
import { msToTimestamp } from "$/utils/timestamp";

/** Ctrl/Cmd+K toggles an amll:marks cue at the current playhead. */
export const CueKeyBinding = () => {
	const store = useStore();
	const { t } = useTranslation();

	const handleAddCue = useCallback(() => {
		if (!audioEngine.musicLoaded) return;
		const timeMs = Math.round(store.get(currentTimeAtom));
		const before = store.get(lyricLinesAtom).marks?.length ?? 0;
		store.set(lyricLinesAtom, (prev) => toggleMarkAt(prev, timeMs));
		const after = store.get(lyricLinesAtom).marks?.length ?? 0;
		if (after > before) {
			toast.info(
				t("audio.cueAdded", "Cue added at {time}", {
					time: msToTimestamp(timeMs),
				}),
				{ autoClose: 1500 },
			);
		} else if (after < before) {
			toast.info(
				t("audio.cueRemoved", "Cue removed at {time}", {
					time: msToTimestamp(timeMs),
				}),
				{ autoClose: 1500 },
			);
		}
	}, [store, t]);

	useKeyBindingAtom(keyAddCueAtPlayheadAtom, handleAddCue, [handleAddCue]);

	return null;
};
