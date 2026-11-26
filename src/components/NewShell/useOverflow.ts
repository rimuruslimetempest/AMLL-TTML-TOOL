import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Detects horizontal overflow on an element. The command bar uses this to
 * decide whether the "More" control is needed, instead of guessing from a
 * media query. A mutation observer keeps the result correct when the active
 * ribbon changes mode.
 */
export function useOverflow(
	ref: RefObject<HTMLElement | null>,
	enabled = true,
) {
	const [overflowing, setOverflowing] = useState(false);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || !enabled) {
			setOverflowing(false);
			return;
		}

		let timer = 0;
		const check = () => {
			timer = 0;
			setOverflowing(element.scrollWidth > element.clientWidth + 1);
		};
		const schedule = () => {
			if (timer) return;
			timer = window.setTimeout(check, 16);
		};

		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(schedule);
		resizeObserver?.observe(element);

		const mutationObserver =
			typeof MutationObserver === "undefined"
				? null
				: new MutationObserver(schedule);
		mutationObserver?.observe(element, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});

		void document.fonts?.ready.then(schedule);
		// Seed immediately so a paused/background tab still shows More.
		check();

		return () => {
			if (timer) window.clearTimeout(timer);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
		};
	}, [ref, enabled]);

	return overflowing;
}
