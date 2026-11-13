import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	lyricLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { can } from "$/modules/collab/permissions";
import {
	collabActiveAtom,
	collabRoleAtom,
	collabSplitDictionaryAtom,
} from "$/modules/collab/states";
import {
	patternsForWord,
	partsForPattern,
	savePatternToLibrary,
	sharedSplitToPattern,
	splitWordKey,
	splitWordWithPattern,
} from "../logic";
import {
	splitLibraryAtom,
	splitLibraryDialogAtom,
	splitLibraryIndexAtom,
} from "../states";

/**
 * A small, dismissible suggestion shown only when exactly one word is selected
 * and that word has a saved pattern. It never changes the song by itself.
 */
export function SplitSuggestion() {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const mode = useAtomValue(toolModeAtom);
	const library = useAtomValue(splitLibraryAtom);
	const index = useAtomValue(splitLibraryIndexAtom);
	const setLibraryDialog = useSetAtom(splitLibraryDialogAtom);
	const setSelectedWords = useSetAtom(selectedWordsAtom);
	const setLibrary = useSetAtom(splitLibraryAtom);
	const roomSplits = useAtomValue(collabSplitDictionaryAtom);
	const collabActive = useAtomValue(collabActiveAtom);
	const collabRole = useAtomValue(collabRoleAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const canEditLyrics = !collabActive || can(collabRole, "editLyrics");

	const target = useMemo(() => {
		if (selectedWords.size !== 1) return null;
		const wordId = [...selectedWords][0];
		for (let lineIndex = 0; lineIndex < lyrics.lyricLines.length; lineIndex++) {
			const line = lyrics.lyricLines[lineIndex];
			const wordIndex = line.words.findIndex((word) => word.id === wordId);
			if (wordIndex >= 0) {
				return { lineIndex, wordIndex, word: line.words[wordIndex] };
			}
		}
		return null;
	}, [lyrics.lyricLines, selectedWords]);

	const patterns = target ? patternsForWord(index, target.word.word) : [];
	const roomMatches =
		target && collabActive && can(collabRole, "viewRoomSplits")
			? roomSplits.filter(
					(entry) => entry.wordKey === splitWordKey(target.word.word),
				)
			: [];
	const visible =
		!!target &&
		canEditLyrics &&
		mode !== ToolMode.Preview &&
		target.word.word.trim().length > 1 &&
		((library.settings.suggestSplits && patterns.length > 0) ||
			roomMatches.length > 0);

	const applyPattern = (patternId: string) => {
		if (!target) return;
		const pattern = patterns.find((candidate) => candidate.id === patternId);
		if (!pattern) return;
		const pieces = splitWordWithPattern(target.word, pattern, "library");
		if (pieces.length <= 1) return;
		editLyricLines((state) => {
			const line = state.lyricLines[target.lineIndex];
			if (!line) return;
			const wordIndex = line.words.findIndex(
				(word) => word.id === target.word.id,
			);
			if (wordIndex < 0) return;
			line.words.splice(wordIndex, 1, ...pieces);
		});
		const first = pieces[0];
		if (first) {
			// Keep the first part selected; the old word id no longer exists.
			setSelectedWords(new Set([first.id]));
		}
		toast.success(
			t("splitLibrary.applied", {
				pattern: partsForPattern(pattern.displayWord, pattern.boundaries).join(
					" / ",
				),
				defaultValue: "Saved split applied.",
			}),
		);
	};

	const applyRoomSplit = (id: string) => {
		if (!target) return;
		const suggestion = roomMatches.find((entry) => entry.id === id);
		if (!suggestion) return;
		const pieces = splitWordWithPattern(target.word, suggestion, "room");
		if (pieces.length <= 1) return;
		editLyricLines((state) => {
			const line = state.lyricLines[target.lineIndex];
			if (!line) return;
			const wordIndex = line.words.findIndex(
				(word) => word.id === target.word.id,
			);
			if (wordIndex < 0) return;
			line.words.splice(wordIndex, 1, ...pieces);
		});
		const first = pieces[0];
		if (first) setSelectedWords(new Set([first.id]));
		toast.success("Room suggestion applied.");
	};

	const saveRoomSplit = (id: string) => {
		const suggestion = roomMatches.find((entry) => entry.id === id);
		if (!suggestion) return;
		const pattern = sharedSplitToPattern(suggestion);
		if (!pattern) return;
		setLibrary((current) => savePatternToLibrary(current, pattern));
		toast.success("Saved the room suggestion to your split library.");
	};

	useEffect(() => {
		if (!visible || patterns.length === 0) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
			if (event.key.toLowerCase() !== "j") return;
			event.preventDefault();
			const first = patterns[0];
			if (first) applyPattern(first.id);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (!visible || !target) return null;

	return (
		<Card
			size="1"
			variant="surface"
			style={{
				position: "fixed",
				bottom: 76,
				left: "50%",
				transform: "translateX(-50%)",
				zIndex: 40,
				boxShadow: "var(--shadow-5)",
				maxWidth: "min(92vw, 620px)",
			}}
		>
			<Flex direction="column" gap="2">
				<Text size="1" color="gray">
					{t("splitLibrary.suggestionTitle", "Apply saved split")}
				</Text>
				<Flex gap="2" wrap="wrap" align="center">
					{patterns.slice(0, 3).map((pattern, patternIndex) => (
						<Button
							key={pattern.id}
							size="1"
							variant={patternIndex === 0 ? "solid" : "soft"}
							onClick={() => applyPattern(pattern.id)}
						>
							{partsForPattern(pattern.displayWord, pattern.boundaries).join(
								" / ",
							)}
							{pattern.isDefault ? ` · ${t("splitLibrary.default", "Default")}` : ""}
						</Button>
					))}
					<Button
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setLibraryDialog(true)}
					>
						{t("splitLibrary.manage", "Manage library")}
					</Button>
				</Flex>
				{roomMatches.length > 0 && (
					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							{t("splitLibrary.roomSuggestions", "Room suggestions")}
						</Text>
						{roomMatches.map((entry) => (
							<Flex key={entry.id} gap="2" align="center" wrap="wrap">
								<Text size="1">
									{partsForPattern(entry.displayWord, entry.boundaries).join(
										" / ",
									)}{" "}
									<Text color="gray">by {entry.addedByName}</Text>
								</Text>
								<Button
									size="1"
									variant="soft"
									onClick={() => applyRoomSplit(entry.id)}
								>
									{t("splitLibrary.apply", "Apply")}
								</Button>
								<Button
									size="1"
									variant="ghost"
									onClick={() => saveRoomSplit(entry.id)}
								>
									{t("splitLibrary.saveMine", "Save to my library")}
								</Button>
							</Flex>
						))}
					</Flex>
				)}
				<Text size="1" color="gray">
					{t("splitLibrary.hotkeyHint", "Ctrl+Shift+J applies the first pattern")}
				</Text>
			</Flex>
		</Card>
	);
}
