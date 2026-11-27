import { type RefObject, useEffect } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { frameScheduler } from "$/modules/performance/scheduler";
import {
	createPreviewScroll,
	type PreviewScrollTarget,
} from "./preview-scroll";

export function usePreviewScroll(
	viewport: RefObject<HTMLElement | null>,
	getTarget: (timeMs: number) => PreviewScrollTarget | undefined,
	offset = 0,
) {
	useEffect(() => {
		if (!viewport.current) return;
		let currentTimeMs = audioEngine.musicCurrentTime * 1000;
		let lastTimeMs = -1;
		const scroll = createPreviewScroll(viewport.current, {
			getTarget: () => getTarget(currentTimeMs),
			offset,
		});
		const unsubscribe = frameScheduler.subscribe(
			(frame) => {
				const seeked =
					lastTimeMs < 0 || Math.abs(frame.timeMs - lastTimeMs) > 1000;
				currentTimeMs = frame.timeMs;
				lastTimeMs = frame.timeMs;
				scroll.follow(seeked);
			},
			{ audio: true, label: "preview-scroll" },
		);
		scroll.follow(true);
		return () => {
			unsubscribe();
			scroll.dispose();
		};
	}, [viewport, getTarget, offset]);
}
