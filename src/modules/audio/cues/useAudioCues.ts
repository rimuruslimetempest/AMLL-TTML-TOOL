import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	type CueSound,
	cueInPreviewAtom,
	cueMinGapMsAtom,
	cueSoundAtom,
	cueSourcesAtom,
	cuesEnabledAtom,
	cueVolumeAtom,
} from "$/modules/settings/states/cues";
import { lyricLinesAtom, ToolMode, toolModeAtom } from "$/states/main";
import { CueScheduler } from "./cue-scheduler";
import { type CueEvent, collectCues, cueListsEqual } from "./cue-sources";

interface PendingCue {
	timeMs: number;
	source: AudioBufferSourceNode;
}

interface CueSettings {
	enabled: boolean;
	sound: CueSound;
	inPreview: boolean;
	volume: number;
	toolMode: ToolMode;
}

/**
 * Plays short monitoring clicks whenever the playhead crosses a cue.
 * Mount once (App) and let it read settings and lyrics from atoms.
 */
export const useAudioCues = () => {
	const lyrics = useAtomValue(lyricLinesAtom);
	const sources = useAtomValue(cueSourcesAtom);
	const minGapMs = useAtomValue(cueMinGapMsAtom);
	const enabled = useAtomValue(cuesEnabledAtom);
	const volume = useAtomValue(cueVolumeAtom);
	const sound = useAtomValue(cueSoundAtom);
	const inPreview = useAtomValue(cueInPreviewAtom);
	const toolMode = useAtomValue(toolModeAtom);

	const schedulerRef = useRef<CueScheduler | null>(null);
	if (!schedulerRef.current) schedulerRef.current = new CueScheduler();
	const scheduler = schedulerRef.current;

	const pendingRef = useRef<PendingCue[]>([]);
	const previousCuesRef = useRef<CueEvent[] | null>(null);

	const settingsRef = useRef<CueSettings>({
		enabled,
		sound,
		inPreview,
		volume,
		toolMode,
	});
	settingsRef.current = { enabled, sound, inPreview, volume, toolMode };

	const cues = useMemo(
		() => collectCues(lyrics, sources, minGapMs),
		[lyrics, sources, minGapMs],
	);

	const cancelPending = useCallback(() => {
		for (const pending of pendingRef.current) {
			try {
				pending.source.stop();
			} catch {
				// Already finished.
			}
			pending.source.disconnect();
		}
		pendingRef.current = [];
	}, []);

	useEffect(() => {
		audioEngine.cueVolume = volume;
	}, [volume]);

	useEffect(() => {
		const previous = previousCuesRef.current;
		previousCuesRef.current = cues;
		scheduler.setCues(cues);

		// Edits that do not move a cue (typing a word, renaming a marker) must
		// not cancel clicks already queued ahead of the playhead.
		if (!audioEngine.musicPlaying) return;
		if (previous && cueListsEqual(previous, cues)) return;

		cancelPending();
		scheduler.rearm(audioEngine.musicCurrentTime * 1000);
	}, [cues, scheduler, cancelPending]);

	const audible =
		enabled && volume > 0 && (toolMode !== ToolMode.Preview || inPreview);
	useEffect(() => {
		if (!audible) cancelPending();
	}, [audible, cancelPending]);

	useEffect(() => {
		const cancelAndRearm = () => {
			cancelPending();
			scheduler.rearm(audioEngine.musicCurrentTime * 1000);
		};
		const onUnload = () => {
			cancelPending();
			scheduler.rearm(0);
		};
		const onTick = () => {
			const current = settingsRef.current;
			if (!current.enabled || current.volume <= 0) return;
			if (current.toolMode === ToolMode.Preview && !current.inPreview) return;
			if (!audioEngine.musicPlaying) return;

			const timelineMs = audioEngine.musicCurrentTime * 1000;
			scheduler.tick(
				{
					timelineMs,
					contextTime: audioEngine.ctxCurrentTime,
					rate: audioEngine.musicPlayBackRate,
					playing: true,
				},
				(seconds) => audioEngine.renderTimeForTimeline(seconds),
				(cue, contextTime) => {
					try {
						const source = audioEngine.playCue(current.sound, contextTime);
						pendingRef.current.push({ timeMs: cue.timeMs, source });
					} catch {
						// A closed or suspended context drops the click.
					}
				},
			);

			pendingRef.current = pendingRef.current.filter(
				(pending) => pending.timeMs > timelineMs - 1000,
			);
		};

		audioEngine.addEventListener("music-timeupdate", onTick);
		audioEngine.addEventListener("music-seeked", cancelAndRearm);
		audioEngine.addEventListener("music-resume", cancelAndRearm);
		audioEngine.addEventListener("music-pause", cancelAndRearm);
		audioEngine.addEventListener("music-playback-rate-change", cancelAndRearm);
		audioEngine.addEventListener("music-unload", onUnload);

		return () => {
			audioEngine.removeEventListener("music-timeupdate", onTick);
			audioEngine.removeEventListener("music-seeked", cancelAndRearm);
			audioEngine.removeEventListener("music-resume", cancelAndRearm);
			audioEngine.removeEventListener("music-pause", cancelAndRearm);
			audioEngine.removeEventListener(
				"music-playback-rate-change",
				cancelAndRearm,
			);
			audioEngine.removeEventListener("music-unload", onUnload);
			cancelPending();
		};
	}, [scheduler, cancelPending]);
};
