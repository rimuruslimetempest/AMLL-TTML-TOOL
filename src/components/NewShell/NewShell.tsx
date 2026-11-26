import { type ReactNode, useEffect, useRef } from "react";
import { NewWorkspace } from "./NewWorkspace";
import { WorkspaceOverlayHost } from "./WorkspaceOverlayHost";
import { useChromeMetrics } from "./useChromeMetrics";
import styles from "./NewShell.module.css";

export interface NewShellProps {
	/** Top chrome rows: top bar, banner, tab rail, command bar. */
	topChrome: ReactNode;
	/** Bottom chrome row: status bar. */
	footer?: ReactNode;
	/** The editor workspace. */
	children: ReactNode;
}

/**
 * The New layer's real shell. Chrome is laid out as flex rows with a single
 * growing workspace, so no fixed-position surface can sit on top of another.
 */
export function NewShell({ topChrome, footer, children }: NewShellProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	useChromeMetrics(rootRef);

	useEffect(() => {
		const doc = document.documentElement;
		const previous = doc.dataset.ttmlShell;
		doc.dataset.ttmlShell = "new";
		return () => {
			if (previous) doc.dataset.ttmlShell = previous;
			else delete doc.dataset.ttmlShell;
		};
	}, []);

	return (
		<div className={styles.shell} ref={rootRef} data-ttml-shell="new">
			{topChrome}
			<NewWorkspace>{children}</NewWorkspace>
			{footer}
			<WorkspaceOverlayHost />
		</div>
	);
}
