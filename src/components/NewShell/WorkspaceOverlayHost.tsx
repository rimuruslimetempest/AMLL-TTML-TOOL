import { FindReplaceBar } from "$/modules/lyric-editor/tools/FindReplaceBar";
import styles from "./NewShell.module.css";

/**
 * Overlays that belong to the editor, not the window. Keeping Find/Replace
 * here means it can never land on the tab rail or the transport: the layer is
 * bounded by the measured workspace rectangle.
 */
export function WorkspaceOverlayHost() {
	return (
		<div className={styles.overlayLayer} data-workspace-overlay-host="">
			<FindReplaceBar />
		</div>
	);
}
