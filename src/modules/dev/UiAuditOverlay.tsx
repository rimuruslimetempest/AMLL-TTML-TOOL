import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ui-audit.module.css";

interface AuditFinding {
	element: HTMLElement;
	selector: string;
	detail: string;
}

interface PreviousOutline {
	outline: string;
	outlineOffset: string;
}

const MAX_FINDINGS = 120;
const SKIP_TAGS = new Set([
	"SCRIPT",
	"STYLE",
	"LINK",
	"META",
	"HEAD",
	"TITLE",
	"BR",
	"HR",
	"SOURCE",
	"TRACK",
]);

function auditEnabled(): boolean {
	if (!import.meta.env.DEV || typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("uiAudit") === "1";
}

function describeElement(element: HTMLElement): string {
	const id = element.id ? `#${element.id}` : "";
	const classes = [...element.classList]
		.slice(0, 2)
		.map((name) => `.${name}`)
		.join("");
	const label = element.getAttribute("aria-label");
	return `${element.tagName.toLowerCase()}${id}${classes}${
		label ? `[aria-label="${label.slice(0, 28)}"]` : ""
	}`;
}

function isScrollable(value: string): boolean {
	return value === "auto" || value === "scroll";
}

export function UiAuditOverlay() {
	const [open, setOpen] = useState(() => auditEnabled());
	const [findings, setFindings] = useState<AuditFinding[]>([]);
	const marked = useRef(new Map<HTMLElement, PreviousOutline>());

	const clearMarks = useCallback(() => {
		for (const [element, previous] of marked.current) {
			element.style.outline = previous.outline;
			element.style.outlineOffset = previous.outlineOffset;
		}
		marked.current.clear();
	}, []);

	const runAudit = useCallback(() => {
		if (!auditEnabled()) return;
		clearMarks();
		const found: AuditFinding[] = [];
		const elements = document.body.querySelectorAll<HTMLElement>("*");

		for (const element of elements) {
			if (found.length >= MAX_FINDINGS) break;
			if (SKIP_TAGS.has(element.tagName)) continue;
			if (element.closest("[data-ui-audit]")) continue;
			if (element.getAttribute("data-ui-audit-ignore") === "true") continue;

			const style = getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0"
			) {
				continue;
			}
			if (style.textOverflow === "ellipsis") continue;

			const rect = element.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;

			const clippedX =
				element.scrollWidth > element.clientWidth + 1 &&
				!isScrollable(style.overflowX);
			const clippedY =
				element.scrollHeight > element.clientHeight + 1 &&
				!isScrollable(style.overflowY);
			if (!clippedX && !clippedY) continue;

			const previous = {
				outline: element.style.outline,
				outlineOffset: element.style.outlineOffset,
			};
			element.style.outline = "2px solid #ff5c5c";
			element.style.outlineOffset = "-2px";
			marked.current.set(element, previous);

			const detail = [
				clippedX
					? `x ${element.scrollWidth} > ${element.clientWidth}`
					: null,
				clippedY
					? `y ${element.scrollHeight} > ${element.clientHeight}`
					: null,
				`${Math.round(rect.width)}×${Math.round(rect.height)}`,
			]
				.filter(Boolean)
				.join(" · ");

			found.push({
				element,
				selector: describeElement(element),
				detail,
			});
		}

		const root = document.documentElement;
		if (
			root.scrollWidth > root.clientWidth + 1 &&
			found.length < MAX_FINDINGS
		) {
			found.push({
				element: root,
				selector: "html",
				detail: `document x ${root.scrollWidth} > ${root.clientWidth}`,
			});
		}

		setFindings(found);
	}, [clearMarks]);

	useEffect(() => {
		if (!auditEnabled()) return;
		const timer = window.setTimeout(runAudit, 900);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.altKey && event.shiftKey && event.key.toLowerCase() === "u") {
				event.preventDefault();
				setOpen((value) => !value);
				window.setTimeout(runAudit, 0);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("keydown", onKeyDown);
			clearMarks();
		};
	}, [clearMarks, runAudit]);

	if (!auditEnabled() || !open) return null;

	return (
		<div className={styles.panel} data-ui-audit>
			<div className={styles.header}>
				<span className={styles.title}>
					UI overflow audit · {findings.length}
				</span>
				<div className={styles.actions}>
					<button
						type="button"
						className={styles.button}
						onClick={runAudit}
					>
						Refresh
					</button>
					<button
						type="button"
						className={styles.button}
						onClick={() => {
							clearMarks();
							setOpen(false);
						}}
						aria-label="Close UI audit"
					>
						×
					</button>
				</div>
			</div>
			{findings.length > 0 ? (
				<div className={styles.list}>
					{findings.map((finding, index) => (
						<button
							type="button"
							key={`${finding.selector}-${index}`}
							className={styles.item}
							onClick={() => {
								finding.element.scrollIntoView({
									block: "center",
									inline: "nearest",
								});
							}}
						>
							<div className={styles.selector}>{finding.selector}</div>
							<div className={styles.meta}>{finding.detail}</div>
						</button>
					))}
				</div>
			) : (
				<div className={styles.empty}>
					No clipped overflow found. Open Settings, Themes, or a dialog and
					refresh.
				</div>
			)}
		</div>
	);
}
