import { useEffect } from "react";
import { toast } from "react-toastify";
import { binByteSize, enforceSizeCap, pruneExpired } from "./logic";
import { loadRecycleBin, saveRecycleBin } from "./storage";

const WARNED_KEY = "ttml_recycle_bin_size_warned";

/**
 * Runs the retention and size cleanup once at startup. The cleanup is quiet:
 * expired records are removed permanently, and a single warning appears when
 * the bin is close to its cap.
 */
export function RecycleBinProvider() {
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const bin = await loadRecycleBin();
			if (cancelled) return;
			const pruned = pruneExpired(bin.items, bin.settings.retentionDays);
			const capped = enforceSizeCap(pruned.kept, bin.settings.maxBytes);
			const changed =
				pruned.removed.length > 0 ||
				capped.removed.length > 0;
			const next = { ...bin, items: capped.kept };
			if (changed) await saveRecycleBin(next);
			if (pruned.removed.length > 0) {
				toast.info(
					`${pruned.removed.length} old recycle-bin item(s) were removed after the retention period.`,
				);
			}
			const size = binByteSize(next);
			if (
				size > next.settings.maxBytes * 0.8 &&
				!sessionStorage.getItem(WARNED_KEY)
			) {
				sessionStorage.setItem(WARNED_KEY, "1");
				toast.warning(
					"The recycle bin is close to its size limit. Older items will be removed first.",
				);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);
	return null;
}
