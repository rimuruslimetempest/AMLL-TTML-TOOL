import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { confirmDialogAtom } from "$/states/dialogs";
import { loadSplitLibrary, saveSplitLibrary } from "./storage";
import {
	applySavedSplitsDialogAtom,
	savedSplitsImportOfferAtom,
	splitLibraryAtom,
	splitLibraryErrorAtom,
	splitLibraryReadyAtom,
} from "./states";

/**
 * Loads the personal split library once and writes changes back after a short
 * idle period. It lives outside project files, so opening another song never
 * replaces it.
 */
export function SplitLibraryProvider() {
	const [library, setLibrary] = useAtom(splitLibraryAtom);
	const [ready, setReady] = useAtom(splitLibraryReadyAtom);
	const [, setError] = useAtom(splitLibraryErrorAtom);
	const [importOffer, setImportOffer] = useAtom(savedSplitsImportOfferAtom);
	const setApplyDialog = useSetAtom(applySavedSplitsDialogAtom);
	const setConfirm = useSetAtom(confirmDialogAtom);
	const hydrated = useRef(false);

	useEffect(() => {
		let cancelled = false;
		loadSplitLibrary()
			.then((loaded) => {
				if (cancelled) return;
				setLibrary(loaded);
				hydrated.current = true;
				setReady(true);
			})
			.catch((reason: unknown) => {
				if (cancelled) return;
				const message =
					reason instanceof Error
						? reason.message
						: "Could not load your split library.";
				setError(message);
				hydrated.current = true;
				setReady(true);
			});
		return () => {
			cancelled = true;
		};
	}, [setLibrary, setReady, setError]);

	// Offer saved splits after an import. Nothing is applied here: confirming
	// only opens the existing preview dialog, where every change is listed.
	useEffect(() => {
		if (!importOffer || !ready) return;
		setImportOffer(0);
		if (library.patterns.length === 0) return;
		const timer = setTimeout(() => {
			setConfirm({
				open: true,
				title: "Apply your saved splits?",
				description:
					"Your split library has patterns for words in the lyrics you just imported. You will see a preview before anything changes.",
				confirmText: "Preview splits",
				onConfirm: () => setApplyDialog(true),
			});
		}, 500);
		return () => clearTimeout(timer);
	}, [
		importOffer,
		ready,
		library.patterns.length,
		setImportOffer,
		setApplyDialog,
		setConfirm,
	]);

	useEffect(() => {
		if (!hydrated.current || !ready) return;
		const timer = setTimeout(() => {
			saveSplitLibrary(library).catch((reason: unknown) => {
				const message =
					reason instanceof Error
						? reason.message
						: "Could not save your split library.";
				setError(message);
				toast.error(message);
			});
		}, 400);
		return () => clearTimeout(timer);
	}, [library, ready, setError]);

	return null;
}
