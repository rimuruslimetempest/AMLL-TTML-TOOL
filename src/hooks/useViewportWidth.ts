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
		let frame = 0;

		const updateWidth = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				setWidth(window.innerWidth);
			});
		};

		window.addEventListener("resize", updateWidth, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", updateWidth);
		};
	}, []);

	return width;
}
