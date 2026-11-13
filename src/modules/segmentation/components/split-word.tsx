import { Info16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentationCustomRulesAtom,
	segmentationEngineAtom,
	segmentationIgnoreListTextAtom,
	segmentationLearnedRulesAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
	splitWordApplyToAllAtom,
	splitWordIgnoreCaseAtom,
	splitWordRememberAtom,
} from "$/modules/segmentation/states";
import type {
	HyphenatorFunc,
	SegmentationConfig,
} from "$/modules/segmentation/types";
import { loadHyphenator } from "$/modules/segmentation/utils/hyphen-loader.ts";
import {
	applyLearnedRule,
	createLearnedRule,
	getLearnedWordParts,
} from "$/modules/segmentation/utils/learned-rules";
import {
	getHyphenationLanguage,
	getSyllabificationEngine,
} from "$/modules/segmentation/utils/syllabification-engines";
import {
	recalculateWordTime,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation.ts";
import { can } from "$/modules/collab/permissions";
import {
	collabActiveAtom,
	collabRoleAtom,
} from "$/modules/collab/states";
import { collabClient } from "$/modules/collab/client";
import {
	createSplitPattern,
	partsForPattern,
	patternsForWord,
	savePatternToLibrary,
	splitSourceLabel,
} from "$/modules/split-library/logic";
import {
	splitLibraryAtom,
	splitLibraryIndexAtom,
} from "$/modules/split-library/states";
import type { SavedSplitPattern } from "$/modules/split-library/types";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import { editingWordStateAtom, lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { ManualWordSplitter } from "./ManualWordSplitter";

export const SplitWordDialog = memo(() => {
	const [splitWordDialog, splitWordDialogOpen] = useAtom(splitWordDialogAtom);
	const editingState = useAtomValue(editingWordStateAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const splitLibraryIndex = useAtomValue(splitLibraryIndexAtom);
	const setSplitLibrary = useSetAtom(splitLibraryAtom);
	const { t } = useTranslation();

	const [splitIndices, setSplitIndices] = useState(new Set<number>());
	const [targetWordText, setTargetWordText] = useState("");
	const [activeLibraryPatternId, setActiveLibraryPatternId] = useState<
		string | undefined
	>();

	const [applyToAll, setApplyToAll] = useAtom(splitWordApplyToAllAtom);
	const [ignoreCase, setIgnoreCase] = useAtom(splitWordIgnoreCaseAtom);
	const [rememberSplit, setRememberSplit] = useAtom(splitWordRememberAtom);
	const [learnedRules, setLearnedRules] = useAtom(segmentationLearnedRulesAtom);
	const [saveToLibrary, setSaveToLibrary] = useState(false);
	const [shareWithRoom, setShareWithRoom] = useState(false);
	const collabActive = useAtomValue(collabActiveAtom);
	const collabRole = useAtomValue(collabRoleAtom);
	const canShareWithRoom = collabActive && can(collabRole, "addRoomSplit");
	const canEditLyrics = !collabActive || can(collabRole, "editLyrics");
	const [libraryLabel, setLibraryLabel] = useState("");
	const [libraryNote, setLibraryNote] = useState("");
	const engine = useAtomValue(segmentationEngineAtom);

	const splitCJK = useAtomValue(segmentationSplitCJKAtom);
	const splitEnglish = useAtomValue(segmentationSplitEnglishAtom);
	const punctuationMode = useAtomValue(segmentationPunctuationModeAtom);
	const punctuationWeight = useAtomValue(segmentationPunctuationWeightAtom);
	const removeEmptySegments = useAtomValue(segmentationRemoveEmptySegmentsAtom);
	const ignoreListText = useAtomValue(segmentationIgnoreListTextAtom);
	const customRules = useAtomValue(segmentationCustomRulesAtom);
	const [activeHyphenator, setActiveHyphenator] = useState<
		HyphenatorFunc | undefined
	>(undefined);

	useEffect(() => {
		let isMounted = true;

		const fetchHyphenator = async () => {
			const language = getHyphenationLanguage(engine);
			if (!language) {
				setActiveHyphenator(undefined);
				return;
			}
			const func = await loadHyphenator(language);
			if (isMounted && func) {
				setActiveHyphenator(() => func);
			}
		};

		fetchHyphenator();

		return () => {
			isMounted = false;
		};
	}, [engine]);

	const ignoreList = useMemo(() => {
		return new Set(
			ignoreListText.split("\n").filter((line) => line.trim() !== ""),
		);
	}, [ignoreListText]);

	const segmentationConfig = useMemo((): SegmentationConfig => {
		const weight = parseFloat(punctuationWeight);
		const finalPunctuationWeight = Number.isNaN(weight) ? 0.2 : weight;

		return {
			engine,
			splitCJK,
			splitEnglish,
			punctuationMode,
			punctuationWeight: finalPunctuationWeight,
			removeEmptySegments,
			ignoreList,
			customRules,
			learnedRules,
			hyphenator: activeHyphenator,
		};
	}, [
		engine,
		splitCJK,
		splitEnglish,
		punctuationMode,
		punctuationWeight,
		removeEmptySegments,
		ignoreList,
		customRules,
		learnedRules,
		activeHyphenator,
	]);

	const savedPatterns = useMemo(
		() =>
			targetWordText
				? patternsForWord(splitLibraryIndex, targetWordText)
				: [],
		[splitLibraryIndex, targetWordText],
	);

	const activeLine = lyricLines.lyricLines[editingState.lineIndex];
	const activeWord = activeLine?.words[editingState.wordIndex];
	const previousWord = activeLine?.words[editingState.wordIndex - 1];
	const nextWord = activeLine?.words[editingState.wordIndex + 1];
	const canMergePrevious =
		!!previousWord &&
		!!activeWord &&
		!activeWord.word.startsWith(" ") &&
		previousWord.endTime <= activeWord.startTime;
	const canMergeNext =
		!!nextWord &&
		!!activeWord &&
		!nextWord.word.startsWith(" ") &&
		nextWord.startTime >= activeWord.endTime;

	useEffect(() => {
		if (!splitWordDialog) {
			return;
		}

		const line = lyricLines.lyricLines[editingState.lineIndex];
		const word = line?.words[editingState.wordIndex];

		if (word) {
			setTargetWordText(word.word);
			setActiveLibraryPatternId(undefined);
			setSaveToLibrary(false);
			setShareWithRoom(false);
			setLibraryLabel("");
			setLibraryNote("");

			const resultWords = segmentWord(word, segmentationConfig);
			if (resultWords.length > 1) {
				const indices = new Set<number>();
				let currentIndex = 0;
				for (let i = 0; i < resultWords.length - 1; i++) {
					currentIndex += Array.from(resultWords[i].word).length;
					indices.add(currentIndex);
				}
				setSplitIndices(indices);
			} else {
				setSplitIndices(new Set());
			}
		} else {
			setTargetWordText("");
			setSplitIndices(new Set());
		}
	}, [
		splitWordDialog,
		editingState.lineIndex,
		editingState.wordIndex,
		lyricLines,
		segmentationConfig,
	]);

	const toggleSplitPoint = useCallback((index: number) => {
		setActiveLibraryPatternId(undefined);
		setSplitIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const loadSavedPattern = useCallback(
		(pattern: SavedSplitPattern) => {
			const core = getLearnedWordParts(targetWordText);
			if (!core) return;
			setActiveLibraryPatternId(pattern.id);
			setSplitIndices(
				new Set(pattern.boundaries.map((boundary) => boundary + core.coreStart)),
			);
		},
		[targetWordText],
	);

	const handleSplit = useCallback(() => {
		if (!targetWordText || !canEditLyrics) return;

		const sortedIndices = Array.from(splitIndices).sort((a, b) => a - b);
		const buildSegments = (text: string) => {
			const chars = Array.from(text);
			const parts: string[] = [];
			let lastIndex = 0;
			for (const index of sortedIndices) {
				if (index <= lastIndex) continue;
				parts.push(chars.slice(lastIndex, index).join(""));
				lastIndex = index;
			}
			parts.push(chars.slice(lastIndex).join(""));
			return parts.filter((p) => p.length > 0);
		};

		const targetSegments = buildSegments(targetWordText);

		if (targetSegments.length === 0) return;
		const splitRule = createLearnedRule(targetWordText, sortedIndices);
		const learnedRule = rememberSplit ? splitRule : null;
		const ruleForCurrentSplit = splitRule
			? new Map([[splitRule.key, splitRule.boundaries]])
			: null;
		const targetCore = getLearnedWordParts(targetWordText);

		const createNewWords = (
			targetWord: LyricWord,
			segments: string[],
		): LyricWord[] => {
			return recalculateWordTime(
				targetWord,
				segments,
				segmentationConfig,
			).map((word) => ({
				...word,
				splitSource: activeLibraryPatternId
					? ("library" as const)
					: ("manual" as const),
				splitPatternId: activeLibraryPatternId,
			}));
		};

		editLyricLines((state) => {
			if (applyToAll) {
				for (const line of state.lyricLines) {
					line.words = line.words.flatMap((word) => {
						const isMatch = ignoreCase
							? getLearnedWordParts(word.word)?.key === targetCore?.key
							: word.word === targetWordText;

						if (isMatch) {
							const wordSegments =
								ruleForCurrentSplit && ignoreCase
									? applyLearnedRule(word.word, ruleForCurrentSplit) ||
										targetSegments
									: targetSegments;
							return createNewWords(
								word,
								wordSegments.length > 0 ? wordSegments : targetSegments,
							);
						}
						return word;
					});
				}
			} else {
				const line = state.lyricLines[editingState.lineIndex];
				if (line) {
					const word = line.words[editingState.wordIndex];
					if (word && word.word === targetWordText) {
						line.words.splice(
							editingState.wordIndex,
							1,
							...createNewWords(word, targetSegments),
						);
					}
				}
			}
		});

		if (learnedRule) {
			const nextRules = new Map(learnedRules);
			nextRules.set(learnedRule.key, learnedRule.boundaries);
			setLearnedRules(nextRules);
		}

		if (saveToLibrary) {
			const pattern = createSplitPattern(targetWordText, sortedIndices, {
				label: libraryLabel,
				note: libraryNote,
				isDefault: savedPatterns.every((candidate) => !candidate.isDefault),
			});
			if (pattern) {
				setSplitLibrary((library) => savePatternToLibrary(library, pattern));
			}
		}

		if (shareWithRoom && canShareWithRoom) {
			const shared = createSplitPattern(targetWordText, sortedIndices, {
				label: libraryLabel,
				note: libraryNote,
			});
			if (shared) {
				collabClient.shareSplit({
					id: shared.id,
					wordKey: shared.wordKey,
					displayWord: shared.displayWord,
					boundaries: shared.boundaries,
					label: shared.label,
					note: shared.note,
				});
			}
		}
	}, [
		targetWordText,
		splitIndices,
		editLyricLines,
		applyToAll,
		ignoreCase,
		rememberSplit,
		learnedRules,
		setLearnedRules,
		editingState.lineIndex,
		editingState.wordIndex,
		segmentationConfig,
		saveToLibrary,
		libraryLabel,
		libraryNote,
		savedPatterns,
		setSplitLibrary,
		shareWithRoom,
		canShareWithRoom,
		activeLibraryPatternId,
		canEditLyrics,
	]);

	const mergeWithNeighbour = useCallback(
		(direction: "previous" | "next") => {
			if (!canEditLyrics) return;
			editLyricLines((state) => {
				const line = state.lyricLines[editingState.lineIndex];
				if (!line) return;
				const index = editingState.wordIndex;
				const current = line.words[index];
				if (!current) return;
				const neighbourIndex = direction === "previous" ? index - 1 : index + 1;
				const neighbour = line.words[neighbourIndex];
				if (!neighbour) return;
				if (neighbour.word.startsWith(" ")) return;
				const first = direction === "previous" ? neighbour : current;
				const second = direction === "previous" ? current : neighbour;
				const merged: LyricWord = {
					...first,
					word: first.word + second.word,
					startTime: Math.min(first.startTime, second.startTime),
					endTime: Math.max(first.endTime, second.endTime),
					romanWord: "",
					needsReview:
						first.needsReview || second.needsReview ? true : undefined,
					splitSource: undefined,
					splitPatternId: undefined,
				};
				const startIndex =
					direction === "previous" ? neighbourIndex : index;
				line.words.splice(startIndex, 2, merged);
			});
			// The merged token has a new shape; close so the editor can show it.
			splitWordDialogOpen(false);
		},
		[editLyricLines, editingState, splitWordDialogOpen, canEditLyrics],
	);

	return (
		<Dialog.Root open={splitWordDialog} onOpenChange={splitWordDialogOpen}>
			<Dialog.Content style={{ width: "min(96vw, 560px)" }}>
				<Dialog.Title>{t("splitWordDialog.title", "Split Word")}</Dialog.Title>
				{activeWord?.splitSource && (
					<Flex mt="1">
						<Badge color="gray" variant="soft">
							{splitSourceLabel(activeWord.splitSource)}
						</Badge>
					</Flex>
				)}
				<Flex direction="column" gap="2">
					{!canEditLyrics && (
						<Callout.Root color="amber">
							<Callout.Text>
								{t(
									"splitWordDialog.noPermission",
									"Your role in this room cannot change lyrics. Ask the host for editor access.",
								)}
							</Callout.Text>
						</Callout.Root>
					)}
					<Callout.Root color="blue">
						<Callout.Icon>
							<Info16Regular />
						</Callout.Icon>
						<Callout.Text>
							{t(
								"splitWordDialog.tip",
								"After splitting, new words will evenly divide the original word's start/end time.",
							)}
						</Callout.Text>
					</Callout.Root>
					<Callout.Root color="amber">
						<Callout.Text>
							{t(
								"splitWordDialog.pronunciationReminder",
								"Splits should follow how the singer pronounces the word in the recording. Check them against the audio.",
							)}
						</Callout.Text>
					</Callout.Root>

					{savedPatterns.length > 0 && (
						<Flex direction="column" gap="1">
							<Text size="1" color="gray">
								{t(
									"splitWordDialog.savedPatterns",
									"Saved splits for this word (choose one to load it)",
								)}
							</Text>
							<Flex gap="2" wrap="wrap">
								{savedPatterns.slice(0, 6).map((pattern) => (
									<Button
										key={pattern.id}
										size="1"
										variant="soft"
										onClick={() => loadSavedPattern(pattern)}
									>
										{partsForPattern(
											targetWordText,
											pattern.boundaries,
										).join(" / ")}
										{pattern.isDefault && (
											<Badge size="1" color="green" variant="soft">
												{t("splitLibrary.default", "Default")}
											</Badge>
										)}
									</Button>
								))}
							</Flex>
						</Flex>
					)}

					<Box my="3">
						<ManualWordSplitter
							word={targetWordText}
							splitIndices={splitIndices}
							onSplitIndexToggle={toggleSplitPoint}
						/>
						<Flex justify="end" mt="2" gap="2" wrap="wrap">
							<Button
								size="1"
								variant="soft"
								disabled={!canEditLyrics || !canMergePrevious}
								onClick={() => mergeWithNeighbour("previous")}
							>
								{t("splitWordDialog.mergePrevious", "Merge with previous")}
							</Button>
							<Button
								size="1"
								variant="soft"
								disabled={!canEditLyrics || !canMergeNext}
								onClick={() => mergeWithNeighbour("next")}
							>
								{t("splitWordDialog.mergeNext", "Merge with next")}
							</Button>
							<Button
								size="1"
								variant="soft"
								disabled={!targetWordText}
								onClick={() => {
									if (!targetWordText) return;
									const parts = activeHyphenator
										? activeHyphenator(targetWordText)
												.split("\u00AD")
												.filter(Boolean)
										: getSyllabificationEngine(engine).split(targetWordText);
									if (parts.length <= 1) return;
									const indices = new Set<number>();
									let currentIndex = 0;
									for (let i = 0; i < parts.length - 1; i++) {
										currentIndex += Array.from(parts[i]).length;
										indices.add(currentIndex);
									}
									setSplitIndices(indices);
								}}
							>
								{t("splitWordDialog.syllableSplit", "Syllable Split")}
							</Button>
						</Flex>
					</Box>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={applyToAll}
									onCheckedChange={(c) => setApplyToAll(c as boolean)}
								/>
								{t(
									"splitWordDialog.applyToAll",
									"Apply this splitting to all identical words",
								)}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={rememberSplit}
									onCheckedChange={(c) => setRememberSplit(c as boolean)}
								/>
								{t("splitWordDialog.remember", "Remember this split")}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={saveToLibrary}
									onCheckedChange={(c) => setSaveToLibrary(c === true)}
								/>
								{t(
									"splitWordDialog.saveToLibrary",
									"Save to my split library",
								)}
							</Flex>
						</Text>

						{canShareWithRoom && (
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={shareWithRoom}
										onCheckedChange={(c) => setShareWithRoom(c === true)}
									/>
									{t(
										"splitWordDialog.shareWithRoom",
										"Share with room (as a suggestion)",
									)}
								</Flex>
							</Text>
						)}

						{saveToLibrary && (
							<Flex gap="2" wrap="wrap" pl="5">
								<Box style={{ flex: "1 1 150px" }}>
									<TextField.Root
										placeholder={t(
											"splitLibrary.name",
											"Name (optional)",
										)}
										value={libraryLabel}
										onChange={(event) => setLibraryLabel(event.target.value)}
									/>
								</Box>
								<Box style={{ flex: "1 1 210px" }}>
									<TextField.Root
										placeholder={t(
											"splitLibrary.note",
											"Note (optional)",
										)}
										value={libraryNote}
										onChange={(event) => setLibraryNote(event.target.value)}
									/>
								</Box>
							</Flex>
						)}

						<Text as="label" size="2">
							<Flex
								gap="2"
								align="center"
								style={{ opacity: applyToAll ? 1 : 0.5 }}
							>
								<Checkbox
									disabled={!applyToAll}
									checked={ignoreCase}
									onCheckedChange={(c) => setIgnoreCase(c as boolean)}
								/>
								{t("splitWordDialog.ignoreCase", "Ignore case")}
							</Flex>
						</Text>
					</Flex>
				</Flex>

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button onClick={handleSplit} disabled={!canEditLyrics}>
							{t("splitWordDialog.actionButton", "Confirm")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
