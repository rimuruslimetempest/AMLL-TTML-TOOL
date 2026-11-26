import { WorkspaceTabBar } from "$/modules/studio/WorkspaceChrome";
import styles from "./NewTabRail.module.css";

export function NewTabRail() {
	return (
		<div className={styles.rail} data-ttml-chrome="tabs">
			<WorkspaceTabBar />
		</div>
	);
}
