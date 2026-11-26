import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import { ToolMode, toolModeAtom } from "$/states/main";
import {
	QualityController,
	fixedLevelForPreference,
} from "./quality";
import { frameScheduler } from "./scheduler";
import { previewQualityAtom, previewQualityLevelAtom } from "./states";

const DOWNGRADE_NOTICE_KEY = "ttml-quality-downgrade-v1";

/**
 * Applies the chosen visual quality and, in Auto, lets the controller step
 * decoration down when the preview cannot hold 60 FPS. Mount once in App.
 */
export function usePerformanceRuntime() {
	const preference = useAtomValue(previewQualityAtom);
	const level = useAtomValue(previewQualityLevelAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const setLevel = useSetAtom(previewQualityLevelAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);

	useEffect(() => {
		document.documentElement.dataset.previewQuality = String(level);
	}, [level]);

	useEffect(() => {
		const fixed = fixedLevelForPreference(preference);
		if (fixed !== null) {
			setLevel(fixed);
			return;
		}
		// Auto only needs frames while the preview is on screen; outside it the
		// shared loop is allowed to stop.
		if (toolMode !== ToolMode.Preview) return;

		const controller = new QualityController();
		let current = 0;
		setLevel(0);
		const unsubscribe = frameScheduler.subscribe(
			(frame) => {
				if (!frame.playing) return;
				const next = controller.update(frame.dt);
				if (next === current) return;
				const downgraded = next > current;
				current = next;
				setLevel(next);
				if (!downgraded) return;

				try {
					if (sessionStorage.getItem(DOWNGRADE_NOTICE_KEY)) return;
					sessionStorage.setItem(DOWNGRADE_NOTICE_KEY, "1");
				} catch {
					return;
				}
				toast.info(
					"Preview reduced some visual effects to keep motion smooth. You can change this in Settings → Performance.",
					{
						toastId: "preview-quality-suggestion",
						autoClose: 10000,
						closeOnClick: true,
						onClick: () => {
							setSettingsTab("performance");
							setSettingsOpen(true);
						},
					},
				);
			},
			{ label: "quality" },
		);
		return unsubscribe;
	}, [preference, toolMode, setLevel, setSettingsOpen, setSettingsTab]);
}
