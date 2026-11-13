import {
	ArrowDownload20Regular,
	ArrowUpload20Regular,
	Delete16Regular,
	Edit16Regular,
	Search16Regular,
	Star16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Checkbox,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ManualWordSplitter } from "$/modules/segmentation/components/ManualWordSplitter";
import { getLearnedWordParts } from "$/modules/segmentation/utils/learned-rules";
import { saveFile } from "$/utils/fileSystem";
import {
	createSplitPattern,
	parseSplitLibraryJson,
	partsForPattern,
	patternName,
	serializeSplitLibrary,
} from "../logic";
import {
	splitLibraryAtom,
	splitLibraryDialogAtom,
	splitLibraryReadyAtom,
} from "../states";
import type { SavedSplitPattern } from "../types";

const MAX_VISIBLE = 250;

export function SplitLibraryDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(splitLibraryDialogAtom);
	const [library, setLibrary] = useAtom(splitLibraryAtom);
	const [ready] = useAtom(splitLibraryReadyAtom);
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftBoundaries, setDraftBoundaries] = useState<Set<number>>(new Set());
	const [draftLabel, setDraftLabel] = useState("");
	const [draftNote, setDraftNote] = useState("");
	const [draftError, setDraftError] = useState("");
	const fileInput = useRef<HTMLInputElement | null>(null);

	const filtered = useMemo(() => {
		const needle = deferredQuery.trim().toLowerCase();
		const list = needle
			? library.patterns.filter(
					(pattern) =>
						pattern.wordKey.includes(needle) ||
						pattern.displayWord.toLowerCase().includes(needle) ||
						pattern.label.toLowerCase().includes(needle) ||
						pattern.note.toLowerCase().includes(needle),
				)
			: library.patterns;
		return [...list].sort((left, right) => {
			const wordCompare = left.wordKey.localeCompare(right.wordKey);
			if (wordCompare !== 0) return wordCompare;
			if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
			return left.createdAt - right.createdAt;
		});
	}, [deferredQuery, library.patterns]);

	const visible = filtered.slice(0, MAX_VISIBLE);
	const editing = editingId
		? library.patterns.find((pattern) => pattern.id === editingId)
		: undefined;

	const startEditing = (pattern: SavedSplitPattern) => {
		setEditingId(pattern.id);
		setDraftBoundaries(new Set(pattern.boundaries));
		setDraftLabel(pattern.label);
		setDraftNote(pattern.note);
		setDraftError("");
	};

	const cancelEditing = () => {
		setEditingId(null);
		setDraftBoundaries(new Set());
		setDraftError("");
	};

	const saveEditing = () => {
		if (!editing) return;
		const pattern = createSplitPattern(editing.displayWord, draftBoundaries, {
			id: editing.id,
			label: draftLabel,
			note: draftNote,
			isDefault: editing.isDefault,
			now: editing.createdAt,
		});
		if (!pattern) {
			setDraftError(
				t(
					"splitLibrary.needSplitPoint",
					"Add at least one split point before saving.",
				),
			);
			return;
		}
		setLibrary((current) => ({
			...current,
			patterns: current.patterns.map((candidate) =>
				candidate.id === editing.id
					? { ...pattern, updatedAt: Date.now() }
					: candidate,
			),
		}));
		setEditingId(null);
		toast.success(t("splitLibrary.updated", "Split updated."));
	};

	const removePattern = (pattern: SavedSplitPattern) => {
		if (
			!window.confirm(
				t("splitLibrary.confirmDelete", {
					word: patternName(pattern),
					defaultValue: `Delete the saved split “${patternName(pattern)}”?`,
				}),
			)
		) {
			return;
		}
		setLibrary((current) => {
			const patterns = current.patterns.filter(
				(candidate) => candidate.id !== pattern.id,
			);
			if (pattern.isDefault) {
				const replacement = patterns.find(
					(candidate) => candidate.wordKey === pattern.wordKey,
				);
				if (replacement) replacement.isDefault = true;
			}
			return { ...current, patterns };
		});
		if (editingId === pattern.id) cancelEditing();
	};

	const makeDefault = (pattern: SavedSplitPattern) => {
		setLibrary((current) => ({
			...current,
			patterns: current.patterns.map((candidate) =>
				candidate.wordKey === pattern.wordKey
					? {
							...candidate,
							isDefault: candidate.id === pattern.id,
							updatedAt:
								candidate.id === pattern.id ? Date.now() : candidate.updatedAt,
						}
					: candidate,
			),
		}));
	};

	const exportLibrary = async () => {
		try {
			const name = await saveFile(serializeSplitLibrary(library), {
				suggestedName: "ttml-split-library.json",
				types: [
					{
						description: "Split library JSON",
						accept: { "application/json": [".json"] },
					},
				],
			});
			if (name) {
				toast.success(
					t("splitLibrary.exported", "Exported your split library."),
				);
			}
		} catch {
			toast.error(
				t("splitLibrary.exportFailed", "Could not export the split library."),
			);
		}
	};

	const importLibrary = async (file: File) => {
		try {
			const text = await file.text();
			const imported = parseSplitLibraryJson(text);
			setLibrary((current) => {
				const merged = [...current.patterns];
				for (const pattern of imported.patterns) {
					const existing = merged.findIndex(
						(candidate) =>
							candidate.wordKey === pattern.wordKey &&
							candidate.boundaries.join(",") === pattern.boundaries.join(","),
					);
					if (existing >= 0) {
						merged[existing] = {
							...merged[existing],
							label: pattern.label || merged[existing].label,
							note: pattern.note || merged[existing].note,
							updatedAt: Date.now(),
						};
					} else {
						merged.push(pattern);
					}
				}
				return {
					version: 1,
					patterns: merged,
					settings: current.settings,
				};
			});
			toast.success(
				t("splitLibrary.imported", {
					count: imported.patterns.length,
					defaultValue: `Imported ${imported.patterns.length} saved split(s).`,
				}),
			);
		} catch (reason) {
			toast.error(
				reason instanceof Error
					? reason.message
					: t(
							"splitLibrary.importFailed",
							"That file is not a valid split library.",
						),
			);
		}
	};

	const toggleSetting = (
		key: "rememberSplits" | "suggestSplits",
		checked: boolean,
	) => {
		setLibrary((current) => ({
			...current,
			settings: { ...current.settings, [key]: checked },
		}));
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="760px" style={{ width: "min(92vw, 760px)" }}>
				<Dialog.Title>
					{t("splitLibrary.title", "My split library")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"splitLibrary.description",
						"Saved splits are used only when you choose them. They never change how a word is spelled.",
					)}
				</Dialog.Description>

				<Flex gap="2" mb="2" wrap="wrap">
					<Box style={{ flex: "1 1 220px" }}>
						<TextField.Root
							placeholder={t(
								"splitLibrary.search",
								"Search words, names, or notes",
							)}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						>
							<TextField.Slot>
								<Search16Regular />
							</TextField.Slot>
						</TextField.Root>
					</Box>
					<Button variant="soft" onClick={() => fileInput.current?.click()}>
						<ArrowUpload20Regular />
						{t("splitLibrary.import", "Import")}
					</Button>
					<Button
						variant="soft"
						onClick={exportLibrary}
						disabled={library.patterns.length === 0}
					>
						<ArrowDownload20Regular />
						{t("splitLibrary.export", "Export")}
					</Button>
					<input
						ref={fileInput}
						type="file"
						accept="application/json,.json"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void importLibrary(file);
							event.target.value = "";
						}}
					/>
				</Flex>

				<Flex gap="4" mb="3" wrap="wrap">
					<Text as="label" size="2">
						<Flex gap="2" align="center">
							<Checkbox
								checked={library.settings.rememberSplits}
								onCheckedChange={(checked) =>
									toggleSetting("rememberSplits", checked === true)
								}
							/>
							{t(
								"splitLibrary.rememberSplits",
								"Remember my splits automatically",
							)}
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex gap="2" align="center">
							<Checkbox
								checked={library.settings.suggestSplits}
								onCheckedChange={(checked) =>
									toggleSetting("suggestSplits", checked === true)
								}
							/>
							{t(
								"splitLibrary.suggestSplits",
								"Offer saved splits for the selected word",
							)}
						</Flex>
					</Text>
				</Flex>

				{!ready ? (
					<Text size="2" color="gray">
						{t("splitLibrary.loading", "Loading your split library…")}
					</Text>
				) : filtered.length === 0 ? (
					<Callout.Root color="gray">
						<Callout.Text>
							{library.patterns.length === 0
								? t(
										"splitLibrary.empty",
										"No saved splits yet. Open a word’s Split Word dialog and choose “Save to my split library”.",
									)
								: t(
										"splitLibrary.noMatches",
										"No saved splits match that search.",
									)}
						</Callout.Text>
					</Callout.Root>
				) : (
					<ScrollArea style={{ maxHeight: "46vh" }}>
						<Flex direction="column" gap="2" pr="2">
							{visible.map((pattern) => (
								<Card key={pattern.id} variant="surface">
									<Flex direction="column" gap="2">
										<Flex align="center" gap="2" wrap="wrap">
											<Text weight="medium">{pattern.displayWord}</Text>
											<Badge variant="soft" color="gray">
												{partsForPattern(
													pattern.displayWord,
													pattern.boundaries,
												).join(" / ")}
											</Badge>
											{pattern.isDefault && (
												<Badge color="green" variant="soft">
													{t("splitLibrary.default", "Default")}
												</Badge>
											)}
											{pattern.label.trim() && (
												<Text size="1" color="gray">
													{pattern.label}
												</Text>
											)}
											<Flex gap="1" ml="auto">
												<IconButton
													size="1"
													variant="soft"
													title={t("splitLibrary.edit", "Edit")}
													onClick={() => startEditing(pattern)}
												>
													<Edit16Regular />
												</IconButton>
												<IconButton
													size="1"
													variant="soft"
													title={t(
														"splitLibrary.makeDefault",
														"Use as default",
													)}
													disabled={pattern.isDefault}
													onClick={() => makeDefault(pattern)}
												>
													<Star16Regular />
												</IconButton>
												<IconButton
													size="1"
													variant="soft"
													color="red"
													title={t("splitLibrary.delete", "Delete")}
													onClick={() => removePattern(pattern)}
												>
													<Delete16Regular />
												</IconButton>
											</Flex>
										</Flex>
										{pattern.note.trim() && (
											<Text size="1" color="gray">
												{pattern.note}
											</Text>
										)}
										{editingId === pattern.id && (
											<Box
												mt="2"
												p="3"
												style={{
													background: "var(--gray-3)",
													borderRadius: "var(--radius-2)",
												}}
											>
												<Flex direction="column" gap="2">
													<ManualWordSplitter
														word={pattern.displayWord}
														splitIndices={draftBoundaries}
														onSplitIndexToggle={(index) =>
															setDraftBoundaries((current) => {
																const next = new Set(current);
																if (next.has(index)) next.delete(index);
																else next.add(index);
																return next;
															})
														}
													/>
													<Flex gap="2" wrap="wrap">
														<Box style={{ flex: "1 1 160px" }}>
															<TextField.Root
																placeholder={t(
																	"splitLibrary.name",
																	"Name (optional)",
																)}
																value={draftLabel}
																onChange={(event) =>
																	setDraftLabel(event.target.value)
																}
															/>
														</Box>
														<Box style={{ flex: "1 1 220px" }}>
															<TextField.Root
																placeholder={t(
																	"splitLibrary.note",
																	"Note (optional)",
																)}
																value={draftNote}
																onChange={(event) =>
																	setDraftNote(event.target.value)
																}
															/>
														</Box>
													</Flex>
													{draftError && (
														<Text size="1" color="red">
															{draftError}
														</Text>
													)}
													<Flex gap="2" justify="end">
														<Button
															size="1"
															variant="soft"
															color="gray"
															onClick={cancelEditing}
														>
															{t("common.cancel", "Cancel")}
														</Button>
														<Button size="1" onClick={saveEditing}>
															{t("common.save", "Save")}
														</Button>
													</Flex>
												</Flex>
											</Box>
										)}
									</Flex>
								</Card>
							))}
						</Flex>
					</ScrollArea>
				)}

				{filtered.length > MAX_VISIBLE && (
					<Text size="1" color="gray" mt="2">
						{t("splitLibrary.showing", {
							shown: MAX_VISIBLE,
							total: filtered.length,
							defaultValue: `Showing ${MAX_VISIBLE} of ${filtered.length}. Search to narrow the list.`,
						})}
					</Text>
				)}

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button>{t("common.close", "Close")}</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

/** Boundaries are relative to the word core, exactly like the saved pattern. */
export function savedPatternBoundaries(
	word: string,
	pattern: SavedSplitPattern,
): number[] {
	const parts = getLearnedWordParts(word);
	if (!parts) return pattern.boundaries;
	return pattern.boundaries.map((boundary) => boundary + parts.coreStart);
}
