import { Dismiss12Regular } from "@fluentui/react-icons";
import { IconButton } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { mouseFreeModeAtom } from "$/modules/settings/states";
import styles from "./mouse-free-mode.module.css";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled]):not([type='hidden'])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
	"[contenteditable='true']",
].join(",");

/**
 * Elements that own arrow keys themselves. Menus, lists, tabs and sliders use
 * arrows to move their own selection, so mouse-free navigation leaves them be.
 */
const ARROW_OWNER_SELECTOR = [
	"input",
	"textarea",
	"select",
	"[contenteditable='true']",
	"[role='slider']",
	"[role='menu']",
	"[role='menubar']",
	"[role='listbox']",
	"[role='tablist']",
	"[role='toolbar']",
	"[role='tree']",
	"[role='grid']",
].join(",");

function isVisible(element: HTMLElement) {
	if (element.hidden || element.getAttribute("aria-hidden") === "true") {
		return false;
	}
	if (element.closest("[inert]")) return false;
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return false;
	const style = window.getComputedStyle(element);
	return style.visibility !== "hidden" && style.display !== "none";
}

function getFocusableElements() {
	return Array.from(
		document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	).filter(isVisible);
}

function describeElement(element: HTMLElement | null) {
	if (!element) return "";
	const explicit =
		element.getAttribute("aria-label") ||
		element.getAttribute("title") ||
		(element as HTMLInputElement).placeholder;
	const text = (element.textContent || "").replace(/\s+/g, " ").trim();
	return (explicit || text || element.tagName.toLowerCase()).slice(0, 80);
}

function isArrowOwner(target: EventTarget | null) {
	if (!(target instanceof Element)) return false;
	return !!target.closest(ARROW_OWNER_SELECTOR);
}

/**
 * Keyboard-only navigation for the whole window.
 *
 * Arrow keys move focus in reading order, Enter/Space activates the focused
 * control with the browser's native behavior, and Escape clears focus. Text
 * fields, sliders, menus and other arrow-owning widgets keep their keys.
 */
export const MouseFreeMode = () => {
	const [enabled, setEnabled] = useAtom(mouseFreeModeAtom);
	const [announcement, setAnnouncement] = useState("");
	const announcementTimer = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) return;
		document.documentElement.dataset.mouseFree = "true";
		return () => {
			delete document.documentElement.dataset.mouseFree;
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;

		const announce = (text: string) => {
			setAnnouncement(text);
			if (announcementTimer.current !== null) {
				window.clearTimeout(announcementTimer.current);
			}
			announcementTimer.current = window.setTimeout(() => {
				setAnnouncement("");
			}, 2500);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey
			) {
				return;
			}

			const active = document.activeElement;
			const isArrow =
				event.key === "ArrowDown" ||
				event.key === "ArrowRight" ||
				event.key === "ArrowUp" ||
				event.key === "ArrowLeft";

			if (event.key === "Escape") {
				if (
					active instanceof HTMLElement &&
					active !== document.body &&
					!active.closest("[role='dialog']")
				) {
					active.blur();
					announce("Focus cleared. Use the arrow keys to start again.");
				}
				return;
			}

			if (!isArrow || isArrowOwner(event.target)) return;

			const elements = getFocusableElements();
			if (elements.length === 0) return;

			const currentIndex =
				active instanceof HTMLElement ? elements.indexOf(active) : -1;
			const step =
				event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
			const nextIndex =
				currentIndex === -1
					? event.key === "ArrowUp" || event.key === "ArrowLeft"
						? elements.length - 1
						: 0
					: (currentIndex + step + elements.length) % elements.length;

			const next = elements[nextIndex];
			event.preventDefault();
			next.focus();
			announce(`${describeElement(next)} (${nextIndex + 1} of ${elements.length})`);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);

	useEffect(() => {
		return () => {
			if (announcementTimer.current !== null) {
				window.clearTimeout(announcementTimer.current);
			}
		};
	}, []);

	if (!enabled) return null;

	return (
		<>
			<div className={styles.status} role="status">
				<span className={styles.dot} aria-hidden="true" />
				<span className={styles.label}>
					Mouse-free mode
					<span className={styles.hint}>
						Arrows move focus · Enter/Space activates · Esc clears focus
					</span>
				</span>
				<IconButton
					size="1"
					variant="ghost"
					color="gray"
					aria-label="Turn off mouse-free mode"
					title="Turn off mouse-free mode"
					onClick={() => setEnabled(false)}
				>
					<Dismiss12Regular />
				</IconButton>
			</div>
			<div className={styles.srOnly} aria-live="polite">
				{announcement}
			</div>
		</>
	);
};
