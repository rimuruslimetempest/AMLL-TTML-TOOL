export interface PreviewScrollTarget {
	/** The line to place, and the id that makes a repeated follow a no-op. */
	id: string;
	/**
	 * Scroll position that places this target at `anchor`, from measured rows.
	 * The row does not need to be mounted.
	 */
	getTop: (anchor: number, offset: number) => number | undefined;
	/** Not ready to follow yet; ask again next frame. Seeks still jump. */
	deferred?: boolean;
}

const prefersReducedMotion = () =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scroll position that places a line, kept inside the scroll range. */
export function previewScrollTop(
	lineTop: number,
	lineHeight: number,
	viewportHeight: number,
	maxTop: number,
	anchor: number,
	offset: number,
) {
	return Math.max(
		0,
		Math.min(
			maxTop,
			lineTop + lineHeight / 2 - viewportHeight * anchor + offset,
		),
	);
}

/** Shared follow policy; only placement and manual-scroll grace differ by view. */
export function createPreviewScroll(
	viewport: HTMLElement,
	options: {
		getTarget: () => PreviewScrollTarget | undefined;
		offset?: number;
	},
) {
	let lastId: string | undefined;
	let pausedUntil = 0;
	let pointerDown = false;
	let resumeTimer: ReturnType<typeof setTimeout> | undefined;
	let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined;
	let programmatic = false;
	let disposed = false;
	const pauseMs = 750;
	const markProgrammatic = () => {
		programmatic = true;
		clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => {
			programmatic = false;
		}, 100);
	};
	const jumpTo = (top: number) => {
		// scroll-behavior CSS can otherwise animate even an "auto" scroll.
		const behavior = viewport.style.scrollBehavior;
		viewport.style.scrollBehavior = "auto";
		viewport.scrollTo({ top, behavior: "auto" });
		viewport.style.scrollBehavior = behavior;
	};
	const center = (target: PreviewScrollTarget, seeked: boolean) => {
		const top = target.getTop(0.5, options.offset ?? 0);
		if (top === undefined) return;
		markProgrammatic();
		if (seeked || prefersReducedMotion()) jumpTo(top);
		else viewport.scrollTo({ top, behavior: "smooth" });
		lastId = target.id;
	};
	const follow = (seeked = false) => {
		if (disposed || pointerDown) return;
		if (!seeked && performance.now() < pausedUntil) return;
		const target = options.getTarget();
		if (!target) {
			lastId = undefined;
			return;
		}
		if (!seeked && (target.id === lastId || target.deferred)) return;
		center(target, seeked);
	};
	const pause = () => {
		// Stop the native smooth scroll when the user takes control.
		if (programmatic) jumpTo(viewport.scrollTop);
		programmatic = false;
		clearTimeout(scrollIdleTimer);
		pausedUntil = performance.now() + pauseMs;
		clearTimeout(resumeTimer);
		resumeTimer = setTimeout(() => {
			// Retry the active target even if the song has paused in the meantime.
			lastId = undefined;
			follow();
		}, pauseMs);
	};
	const onPointerDown = () => {
		pointerDown = true;
		pause();
	};
	const onPointerUp = () => {
		if (!pointerDown) return;
		pointerDown = false;
		pause();
	};
	const onScroll = () => {
		// Native smooth-scroll events keep this guard alive until scrolling
		// settles. Unsolicited scrolls (keyboard, scrollbar, accessibility)
		// get the same grace period as wheel/touch without a polling loop.
		if (programmatic) markProgrammatic();
		else pause();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (
			[
				"ArrowUp",
				"ArrowDown",
				"PageUp",
				"PageDown",
				"Home",
				"End",
				" ",
			].includes(event.key)
		)
			pause();
	};
	viewport.addEventListener("wheel", pause, { passive: true });
	viewport.addEventListener("touchmove", pause, { passive: true });
	viewport.addEventListener("pointerdown", onPointerDown, { passive: true });
	viewport.addEventListener("scroll", onScroll, { passive: true });
	viewport.addEventListener("keydown", onKeyDown);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerUp);
	return {
		follow,
		dispose: () => {
			disposed = true;
			clearTimeout(resumeTimer);
			clearTimeout(scrollIdleTimer);
			viewport.removeEventListener("wheel", pause);
			viewport.removeEventListener("touchmove", pause);
			viewport.removeEventListener("pointerdown", onPointerDown);
			viewport.removeEventListener("scroll", onScroll);
			viewport.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		},
	};
}
