import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { PerformanceMode } from "$/design-system/types";
import { performanceModePreferenceAtom } from "$/modules/settings/states";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";

const SUGGESTION_SESSION_KEY = "ttml-performance-suggestion-v1";
const FRAME_BUDGET_MS = 22;
const MEASURE_DELAY_MS = 2500;
const MEASURE_WINDOW_MS = 3000;

/**
 * Auto performance mode measures after the app settles and suggests enabling it.
 * It never changes the mode by itself.
 */
export function usePerformanceModeSuggestion() {
	const preference = useAtomValue(performanceModePreferenceAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);

	useEffect(() => {
		if (preference !== PerformanceMode.Auto) return;
		if (typeof window === "undefined") return;

		try {
			if (sessionStorage.getItem(SUGGESTION_SESSION_KEY)) return;
		} catch {
			return;
		}

		let frameId = 0;
		let timerId = 0;

		const finish = () => {
			try {
				sessionStorage.setItem(SUGGESTION_SESSION_KEY, "1");
			} catch {}

			toast.info(
				"Rendering looks slow. Performance Mode can reduce decorative effects without removing editing features.",
				{
					toastId: "performance-mode-suggestion",
					autoClose: 10000,
					closeOnClick: true,
					onClick: () => {
						setSettingsTab("appearance");
						setSettingsOpen(true);
					},
				},
			);
		};

		const measure = () => {
			if (document.visibilityState !== "visible") return;

			let frames = 0;
			let totalMs = 0;
			const startedAt = performance.now();
			let previous = startedAt;

			const tick = (now: number) => {
				const delta = now - previous;
				previous = now;

				if (delta > 0 && delta < 250) {
					frames += 1;
					totalMs += delta;
				}

				if (now - startedAt >= MEASURE_WINDOW_MS) {
					const average = frames > 0 ? totalMs / frames : 0;
					if (frames >= 30 && average > FRAME_BUDGET_MS) {
						finish();
					}
					return;
				}

				frameId = requestAnimationFrame(tick);
			};

			frameId = requestAnimationFrame(tick);
		};

		timerId = window.setTimeout(measure, MEASURE_DELAY_MS);

		return () => {
			window.clearTimeout(timerId);
			cancelAnimationFrame(frameId);
		};
	}, [preference, setSettingsOpen, setSettingsTab]);
}
