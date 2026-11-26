import { type RefObject, useLayoutEffect } from "react";

/**
 * Measures the real New UI chrome and publishes its geometry as CSS custom
 * properties on the document root. Overlays (find, collab, toasts, prompts)
 * anchor to these values instead of guessing a titlebar height.
 *
 * The first measurement is synchronous: requestAnimationFrame can be paused
 * while the window is in the background, and a missing measurement would put
 * every overlay back on the hardcoded fallback.
 */
export function useChromeMetrics(rootRef: RefObject<HTMLElement | null>) {
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const doc = document.documentElement;
		let timer = 0;

		const find = (name: string) =>
			root.querySelector<HTMLElement>(`[data-ttml-chrome="${name}"]`);

		const measure = () => {
			timer = 0;
			const topbar = find("topbar");
			const tabs = find("tabs");
			const command = find("command");
			const workspace = find("workspace");
			const transport = find("transport");
			const status = find("statusbar");

			const height = (element: HTMLElement | null) =>
				element ? element.getBoundingClientRect().height : 0;

			doc.style.setProperty("--ttml-topbar-h", `${height(topbar)}px`);
			doc.style.setProperty("--ttml-tabs-h", `${height(tabs)}px`);
			doc.style.setProperty("--ttml-command-h", `${height(command)}px`);
			doc.style.setProperty(
				"--ttml-transport-h",
				`${height(transport)}px`,
			);
			doc.style.setProperty("--ttml-statusbar-h", `${height(status)}px`);

			if (workspace) {
				const rect = workspace.getBoundingClientRect();
				const transportRect = transport?.getBoundingClientRect();
				// The transport is composed inside the workspace, so the usable
				// content region has to exclude it, not just the status bar.
				const transportOnTop =
					transportRect &&
					transportRect.top < rect.top + rect.height / 2;
				const contentTop = transportOnTop
					? Math.max(rect.top, transportRect.bottom)
					: rect.top;
				const contentBottom =
					transportRect && !transportOnTop
						? Math.max(0, window.innerHeight - transportRect.top)
						: Math.max(0, window.innerHeight - rect.bottom);

				doc.style.setProperty(
					"--ttml-content-top",
					`${Math.max(0, contentTop)}px`,
				);
				doc.style.setProperty(
					"--ttml-content-bottom",
					`${contentBottom}px`,
				);
				doc.style.setProperty("--ttml-workspace-h", `${rect.height}px`);
			}
		};

		const schedule = () => {
			if (timer) return;
			timer = window.setTimeout(measure, 16);
		};

		const targets = [
			find("topbar"),
			find("tabs"),
			find("command"),
			find("workspace"),
			find("transport"),
			find("statusbar"),
		].filter((element): element is HTMLElement => Boolean(element));

		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(schedule);
		for (const target of targets) resizeObserver?.observe(target);

		const mutationObserver =
			typeof MutationObserver === "undefined"
				? null
				: new MutationObserver(schedule);
		mutationObserver?.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "style", "data-stage", "data-expanded"],
		});

		window.addEventListener("resize", schedule);
		void document.fonts?.ready.then(schedule);

		// Always seed the variables, even when timers are throttled.
		measure();

		return () => {
			if (timer) window.clearTimeout(timer);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			window.removeEventListener("resize", schedule);
		};
	}, [rootRef]);
}
