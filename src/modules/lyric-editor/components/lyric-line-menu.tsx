import { ContextMenu, Flex } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { selectAtom } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	formatVoiceLabel,
	getLineVoice,
	getVoiceColor,
	newLyricLine,
	normalizeVoice,
} from "$/types/ttml";
import {
	copyLineText,
	copyLineWithTiming,
	pasteAsNewLine,
	pasteLineText,
} from "$/modules/clipboard-timing/actions";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";
import { mergeLyricLines } from "../utils/merge-lines";
import { MergeLineDialog } from "../modals/MergeLineDialog";
import { repairSectionIntegrity } from "../utils/section-system";
import { duplicateLinesAfterSelection } from "../utils/line-creation";
import { newLineTextFocusAtom } from "./lyric-line-view-states";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);
const totalLinesAtom = selectAtom(
	lyricLinesAtom,
	(state) => state.lyricLines.length,
);

export const LyricLineMenu = ({ lineIndex }: { lineIndex: number }) => {
	const { t } = useTranslation();
	const store = useStore();
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);

	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const totalLines = useAtomValue(totalLinesAtom);

	const [mergePickerOpen, setMergePickerOpen] = React.useState(false);

	const [Bgchecked, setBgChecked] = React.useState(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selected = store.get(selectedLinesAtom);
		const selectedLineObjs = lines.filter((line) => selected.has(line.id));
		if (selectedLineObjs.length === 0) {
			const cur = lines[lineIndex];
			return cur?.isBG ?? false;
		}
		if (selectedLineObjs.every((line) => line.isBG)) return true;
		else if (selectedLineObjs.every((line) => !line.isBG)) return false;
		else return "indeterminate" as const;
	});
	const [DuetChecked, setDuetChecked] = React.useState(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selected = store.get(selectedLinesAtom);
		const selectedLineObjs = lines.filter((line) => selected.has(line.id));
		if (selectedLineObjs.length === 0) {
			const cur = lines[lineIndex];
			return cur?.isDuet ?? false;
		}
		if (selectedLineObjs.every((line) => line.isDuet)) return true;
		else if (selectedLineObjs.every((line) => !line.isDuet)) return false;
		else return "indeterminate" as const;
	});

	const currentVoice = React.useMemo(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selected = store.get(selectedLinesAtom);
		const selectedLineObjs = lines.filter((line) => selected.has(line.id));
		if (selectedLineObjs.length === 0) {
			const cur = lines[lineIndex];
			return cur ? getLineVoice(cur) : "v1";
		}
		const firstVoice = getLineVoice(selectedLineObjs[0]);
		if (selectedLineObjs.every((l) => getLineVoice(l) === firstVoice)) {
			return firstVoice;
		}
		return "mixed";
	}, [store, lineIndex]);

	const availableVoices = React.useMemo(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const voiceSet = new Set<string>(["v1", "v2", "v3", "v4"]);
		for (const l of lines) {
			voiceSet.add(getLineVoice(l));
		}
		return Array.from(voiceSet).sort((a, b) => {
			const numA = parseInt(a.replace(/\D/g, "") || "1", 10);
			const numB = parseInt(b.replace(/\D/g, "") || "1", 10);
			return numA - numB;
		});
	}, [store]);

	function setVoice(voice: string) {
		const norm = normalizeVoice(voice);
		const isDuet = norm !== "v1";
		setDuetChecked(isDuet);
		editLyricLines((state) => {
			const targetIds =
				selectedLines.size > 0
					? selectedLines
					: new Set([state.lyricLines[lineIndex]?.id]);
			for (const line of state.lyricLines) {
				if (targetIds.has(line.id)) {
					line.agent = norm;
					line.isDuet = isDuet;
				}
			}
		});
	}

	function bgOnCheck(checked: boolean) {
		setBgChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isBG = checked;
		});
	}

	function duetOnCheck(checked: boolean) {
		setDuetChecked(checked);
		editLyricLines((state) => {
			const targetIds =
				selectedLines.size > 0
					? selectedLines
					: new Set([state.lyricLines[lineIndex]?.id]);
			for (const line of state.lyricLines) {
				if (targetIds.has(line.id)) {
					line.isDuet = checked;
					line.agent = checked
						? line.agent && line.agent !== "v1"
							? line.agent
							: "v2"
						: "v1";
				}
			}
		});
	}

	function mergeWithPrevious() {
		if (lineIndex <= 0) return;
		let mergedLineId: string | null = null;
		let selectionInvolved = false;
		editLyricLines((state) => {
			const prevLine = state.lyricLines[lineIndex - 1];
			const curLine = state.lyricLines[lineIndex];
			if (!prevLine || !curLine) return;
			selectionInvolved =
				selectedLines.has(prevLine.id) || selectedLines.has(curLine.id);
			const merged = mergeLyricLines([prevLine, curLine]);
			if (!merged) return;
			mergedLineId = merged.id;
			state.lyricLines.splice(lineIndex, 1);
			state.lyricLines.splice(lineIndex - 1, 1, merged);
		});
		if (selectionInvolved && mergedLineId) {
			store.set(selectedLinesAtom, new Set([mergedLineId]));
			store.set(selectedWordsAtom, new Set());
		}
	}

	function mergeWithNext() {
		if (lineIndex >= totalLines - 1) return;
		let mergedLineId: string | null = null;
		let selectionInvolved = false;
		editLyricLines((state) => {
			const curLine = state.lyricLines[lineIndex];
			const nextLine = state.lyricLines[lineIndex + 1];
			if (!curLine || !nextLine) return;
			selectionInvolved =
				selectedLines.has(curLine.id) || selectedLines.has(nextLine.id);
			const merged = mergeLyricLines([curLine, nextLine]);
			if (!merged) return;
			mergedLineId = merged.id;
			state.lyricLines.splice(lineIndex + 1, 1);
			state.lyricLines.splice(lineIndex, 1, merged);
		});
		if (selectionInvolved && mergedLineId) {
			store.set(selectedLinesAtom, new Set([mergedLineId]));
			store.set(selectedWordsAtom, new Set());
		}
	}

	function mergeSelectedLines() {
		if (selectedLinesSize < 2) return;
		editLyricLines((state) => {
			const selectedIdxs = state.lyricLines
				.map((line, idx) => (selectedLines.has(line.id) ? idx : -1))
				.filter((idx) => idx !== -1)
				.sort((a, b) => a - b);
			if (selectedIdxs.length < 2) return;

			const targetLines = selectedIdxs.map((idx) => state.lyricLines[idx]);
			const merged = mergeLyricLines(targetLines);
			if (!merged) return;

			const firstIdx = selectedIdxs[0];
			for (let i = selectedIdxs.length - 1; i >= 1; i--) {
				state.lyricLines.splice(selectedIdxs[i], 1);
			}
			state.lyricLines.splice(firstIdx, 1, merged);
		});
	}

	function copyLines(keepTiming: boolean) {
		let copyIds: string[] = [];
		editLyricLines((state) => {
			copyIds = duplicateLinesAfterSelection(state, selectedLines, {
				keepTiming,
			});
			repairSectionIntegrity(state);
		});
		if (copyIds.length === 0) return;
		store.set(selectedLinesAtom, new Set(copyIds));
		store.set(selectedWordsAtom, new Set());
		store.set(newLineTextFocusAtom, copyIds[0]);
	}

	return (
		<>
			{mergePickerOpen && (
				<MergeLineDialog
					sourceLineIndex={lineIndex}
					open={mergePickerOpen}
					onOpenChange={setMergePickerOpen}
				/>
			)}
			<ContextMenu.CheckboxItem checked={Bgchecked} onCheckedChange={bgOnCheck}>
				{t("contextMenu.bgLyric", "Background Lyric")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.CheckboxItem
				checked={DuetChecked}
				onCheckedChange={duetOnCheck}
			>
				{t("contextMenu.duetLyric", "Duet Lyric")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger>
					{t("contextMenu.voice", "Voice / Singer")}
				</ContextMenu.SubTrigger>
				<ContextMenu.SubContent>
					{availableVoices.map((voice) => (
						<ContextMenu.CheckboxItem
							key={voice}
							checked={currentVoice === voice}
							onSelect={() => setVoice(voice)}
						>
							<Flex align="center" gap="2">
								<span
									style={{
										width: 8,
										height: 8,
										borderRadius: "50%",
										backgroundColor: getVoiceColor(voice),
										display: "inline-block",
									}}
								/>
								{formatVoiceLabel(voice)}
							</Flex>
						</ContextMenu.CheckboxItem>
					))}
					<ContextMenu.Separator />
					<ContextMenu.Item
						onSelect={() => {
							const input = window.prompt(
								t(
									"contextMenu.enterVoicePrompt",
									"Enter voice ID (v1 to v1000):",
								),
								currentVoice !== "mixed" ? currentVoice : "v3",
							);
							if (input) {
								setVoice(input);
							}
						}}
					>
						{t("contextMenu.customVoice", "Custom Voice (v#)...")}
					</ContextMenu.Item>
				</ContextMenu.SubContent>
			</ContextMenu.Sub>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						const cur = state.lyricLines[lineIndex];
						const newLine = newLyricLine();
						if (cur?.sectionId) newLine.sectionId = cur.sectionId;
						if (cur?.geniusHeader) newLine.geniusHeader = cur.geniusHeader;
						state.lyricLines.splice(lineIndex, 0, newLine);
						repairSectionIntegrity(state);
					});
				}}
			>
				{t("contextMenu.insertLineBefore", "Insert Empty Line Before")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						const cur = state.lyricLines[lineIndex];
						const newLine = newLyricLine();
						if (cur?.sectionId) newLine.sectionId = cur.sectionId;
						if (cur?.geniusHeader) newLine.geniusHeader = cur.geniusHeader;
						state.lyricLines.splice(lineIndex + 1, 0, newLine);
						repairSectionIntegrity(state);
					});
				}}
			>
				{t("contextMenu.insertLineAfter", "Insert Empty Line After")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => copyLines(false)}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateLine", {
					count: selectedLinesSize,
					defaultValue: "Duplicate Line",
				})}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => copyLines(true)}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateLineWithTiming", {
					count: selectedLinesSize,
					defaultValue: "Duplicate with Timing",
				})}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					setTimingCopyPlacement(null);
					setGlobalEnableInsert(true);
				}}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateTo", "Duplicate to...")}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger>
					{t("contextMenu.clipboard", "Clipboard")}
				</ContextMenu.SubTrigger>
				<ContextMenu.SubContent>
					<ContextMenu.Item onSelect={copyLineText}>
						{t("contextMenu.copyLineText", "Copy line text")}
					</ContextMenu.Item>
					<ContextMenu.Item onSelect={copyLineWithTiming}>
						{t("contextMenu.copyLineWithTiming", "Copy line with timing")}
					</ContextMenu.Item>
					<ContextMenu.Item onSelect={pasteAsNewLine}>
						{t(
							"contextMenu.pasteAsNewLine",
							"Paste as new line after selected",
						)}
					</ContextMenu.Item>
					<ContextMenu.Item onSelect={pasteLineText}>
						{t(
							"contextMenu.pasteLineText",
							"Paste line text into line",
						)}
					</ContextMenu.Item>
				</ContextMenu.SubContent>
			</ContextMenu.Sub>
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger>
					{t("contextMenu.mergeLine", "Merge line")}
				</ContextMenu.SubTrigger>
				<ContextMenu.SubContent>
					<ContextMenu.Item
						onSelect={mergeWithPrevious}
						disabled={lineIndex <= 0}
					>
						{t("contextMenu.mergeWithPrevious", "Merge with previous line")}
					</ContextMenu.Item>
					<ContextMenu.Item
						onSelect={mergeWithNext}
						disabled={lineIndex >= totalLines - 1}
					>
						{t("contextMenu.mergeWithNext", "Merge with next line")}
					</ContextMenu.Item>
					<ContextMenu.Item
						onSelect={() => setMergePickerOpen(true)}
						disabled={totalLines <= 1}
					>
						{t("contextMenu.mergeWithAnother", "Merge with another line…")}
					</ContextMenu.Item>
					{selectedLinesSize >= 2 && (
						<ContextMenu.Item onSelect={mergeSelectedLines}>
							{t("contextMenu.mergeSelectedLines", {
								count: selectedLinesSize,
								defaultValue: `Merge ${selectedLinesSize} selected lines`,
							})}
						</ContextMenu.Item>
					)}
				</ContextMenu.SubContent>
			</ContextMenu.Sub>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						if (selectedLinesSize === 0) {
							state.lyricLines.splice(lineIndex, 1);
						} else {
							state.lyricLines = state.lyricLines.filter(
								(line) => !selectedLines.has(line.id),
							);
						}
						repairSectionIntegrity(state);
					});
				}}
			>
				{t("contextMenu.deleteLine", {
					count: selectedLinesSize,
					defaultValue: "Delete Line",
				})}
			</ContextMenu.Item>
		</>
	);
};
