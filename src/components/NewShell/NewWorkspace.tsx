import type { ReactNode } from "react";
import styles from "./NewShell.module.css";

export function NewWorkspace({ children }: { children: ReactNode }) {
	return (
		<section
			className={styles.workspace}
			data-ttml-chrome="workspace"
			aria-label="Editor workspace"
		>
			{children}
		</section>
	);
}
