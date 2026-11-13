import { useEffect } from "react";
import {
	copyLineText,
	copyLineTiming,
	copyLineWithTiming,
	openTimingPaste,
	pasteAsNewLine,
} from "../actions";

/**
 * Ctrl+Alt shortcuts mirror the line menus. They never run while the person is
 * typing in a field, so text entry keeps working normally.
 */
export function ClipboardHotkeys() {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || !event.altKey) return;
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			switch (event.key.toLowerCase()) {
				case "c":
					event.preventDefault();
					if (event.shiftKey) copyLineText();
					else copyLineTiming();
					break;
				case "v":
					event.preventDefault();
					openTimingPaste("position", event.shiftKey);
					break;
				case "x":
					event.preventDefault();
					copyLineWithTiming();
					break;
				case "b":
					event.preventDefault();
					pasteAsNewLine();
					break;
				default:
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
	return null;
}
