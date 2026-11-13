import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { currentTimeAtom } from "$/modules/audio/states";
import {
	copyLineTiming,
	openTimingPaste,
} from "$/modules/clipboard-timing/actions";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import {
	createLineTimingSnapshots,
	snapSelectedLineTimingsToTime,
} from "../utils/line-timing";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);

export function LineTimingMenuItems() {
	const { t } = useTranslation();
	const store = useStore();
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const timingCopyPlacement = useAtomValue(timingCopyPlacementAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const toggleTimingCopy = () => {
		if (timingCopyPlacement) {
			setTimingCopyPlacement(null);
			return;
		}

		const lyrics = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const snapshots = createLineTimingSnapshots(lyrics, selectedLineIds);
		if (snapshots.length === 0) return;

		setGlobalEnableInsert(false);
		setTimingCopyPlacement({
			sourceLineIds: snapshots.map(({ sourceLineId }) => sourceLineId),
			snapshots,
		});
	};

	const snapToPlayhead = () => {
		const selectedLineIds = store.get(selectedLinesAtom);
		const currentTime = store.get(currentTimeAtom);
		editLyricLines((state) => {
			snapSelectedLineTimingsToTime(
				state.lyricLines,
				selectedLineIds,
				currentTime,
			);
		});
		setGlobalEnableInsert(false);
		setTimingCopyPlacement(null);
	};

	return (
		<>
			<ContextMenu.Item
				disabled={!timingCopyPlacement && selectedLinesSize === 0}
				onSelect={toggleTimingCopy}
			>
				{timingCopyPlacement
					? t("contextMenu.cancelCopyTimings", "Cancel timing copy")
					: t("contextMenu.copyTimingsTo", "Copy timings to…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedLinesSize === 0}
				onSelect={snapToPlayhead}
			>
				{t(
					"contextMenu.snapSelectedLinesToPlayhead",
					"Snap selected lines to playhead",
				)}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				disabled={selectedLinesSize === 0}
				onSelect={copyLineTiming}
			>
				{t("contextMenu.copyLineTiming", "Copy line timing")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedLinesSize === 0}
				onSelect={() => openTimingPaste("position")}
			>
				{t("contextMenu.pasteLineTiming", "Paste line timing…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedLinesSize === 0}
				onSelect={() => openTimingPaste("stretch")}
			>
				{t(
					"contextMenu.pasteTimingStretch",
					"Paste timing with offset / stretch…",
				)}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedLinesSize === 0}
				onSelect={() => openTimingPaste("position", true)}
			>
				{t(
					"contextMenu.pasteTimingRelative",
					"Paste as relative…",
				)}
			</ContextMenu.Item>
		</>
	);
}
