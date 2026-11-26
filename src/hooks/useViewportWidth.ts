import { useEffect, useState } from "react";

/**
 * Tracks the usable viewport width without re-rendering on every resize event.
 * Components use this only for structural decisions; visual breakpoints stay in
 * CSS so resizing remains cheap.
 */
export function useViewportWidth() {
	const [width, setWidth] = useState(() =>
		typeof window === "undefined" ? 1280 : window.innerWidth,
	);

	useEffect(() => {
		let timer = 0;

		// A timeout, not requestAnimationFrame: rAF is paused in background
		// windows, which would leave structural decisions on a stale width.
		const updateWidth = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				setWidth(window.innerWidth);
			}, 40);
		};

		updateWidth();
		window.addEventListener("resize", updateWidth, { passive: true });
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("resize", updateWidth);
		};
	}, []);

	return width;
}
