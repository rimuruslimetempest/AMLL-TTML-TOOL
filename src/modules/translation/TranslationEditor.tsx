import {
	ArrowDownload16Regular,
	ArrowRight16Regular,
	ArrowUpload16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Checkbox,
	Flex,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
	parseTranslationText,
	translationsToText,
} from "$/modules/collab/project-data";
import {
	Drawer,
	Hint,
	PaneSection,
	focusLine,
} from "$/modules/collab/ui";
import styles from "$/modules/collab/collab-ui.module.css";
import { can } from "$/modules/collab/permissions";
import { collabClient } from "$/modules/collab/client";
import { collabRoleAtom } from "$/modules/collab/states";
import { showWordRomanizationInputAtom } from "$/modules/settings/states";
import { lyricLinesAtom } from "$/states/main";
import {
	romanizationLanguageAtom,
	translationLanguageAtom,
} from "./states";

type Field = "translation" | "romanization";

function downloadText(name: string, text: string) {
	const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TranslationEditor({ onClose }: { onClose: () => void }) {
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const role = useAtomValue(collabRoleAtom);
	const [translationLanguage, setTranslationLanguage] = useAtom(
		translationLanguageAtom,
	);
	const [romanizationLanguage, setRomanizationLanguage] = useAtom(
		romanizationLanguageAtom,
	);
	const [wordMode, setWordMode] = useAtom(showWordRomanizationInputAtom);
	const [missingOnly, setMissingOnly] = useState(false);
	const [query, setQuery] = useState("");
	const [field, setField] = useState<Field>("translation");
	const [importField, setImportField] = useState<Field>("translation");
	const fileRef = useRef<HTMLInputElement>(null);
	const nextMissing = useRef(0);

	const canEdit = !role || can(role, "editLyrics");
	const lines = lyrics.lyricLines;

	const missingTranslation = useMemo(
		() => lines.filter((line) => !line.translatedLyric.trim()).length,
		[lines],
	);
	const missingRomanization = useMemo(
		() => lines.filter((line) => !line.romanLyric.trim()).length,
		[lines],
	);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return lines.filter((line) => {
			if (missingOnly) {
				const missing =
					field === "translation"
						? !line.translatedLyric.trim()
						: !line.romanLyric.trim();
				if (!missing) return false;
			}
			if (!needle) return true;
			const source = line.words.map((word) => word.word).join("");
			return (
				source.toLowerCase().includes(needle) ||
				line.translatedLyric.toLowerCase().includes(needle) ||
				line.romanLyric.toLowerCase().includes(needle)
			);
		});
	}, [lines, query, missingOnly, field]);

	const updateLine = (
		lineId: string,
		which: "translatedLyric" | "romanLyric",
		value: string,
	) => {
		if (!canEdit) {
			collabClient.notify("editLyrics");
			return;
		}
		editLyrics((draft) => {
			const line = draft.lyricLines.find((item) => item.id === lineId);
			if (line) line[which] = value;
		});
	};

	const updateWordRoman = (lineId: string, wordId: string, value: string) => {
		if (!canEdit) {
			collabClient.notify("editLyrics");
			return;
		}
		editLyrics((draft) => {
			const line = draft.lyricLines.find((item) => item.id === lineId);
			const word = line?.words.find((item) => item.id === wordId);
			if (word) word.romanWord = value;
		});
	};

	const exportText = () => {
		const values = lines.map((line) =>
			field === "translation" ? line.translatedLyric : line.romanLyric,
		);
		downloadText(`${field}.txt`, translationsToText(values));
	};

	const importFile = async (file: File) => {
		const text = await file.text();
		const { values, error } = parseTranslationText(text, lines.length);
		if (error) {
			toast.error(`Import stopped: ${error}`);
			return;
		}
		if (!canEdit) {
			collabClient.notify("editLyrics");
			return;
		}
		editLyrics((draft) => {
			draft.lyricLines.forEach((line, index) => {
				const value = values[index] ?? "";
				if (importField === "translation") line.translatedLyric = value;
				else line.romanLyric = value;
			});
		});
		toast.success(
			`Imported ${values.length} ${importField} lines. Timing was not changed.`,
		);
	};

	const jumpNextMissing = () => {
		const missing = lines.filter((line) =>
			field === "translation"
				? !line.translatedLyric.trim()
				: !line.romanLyric.trim(),
		);
		if (missing.length === 0) {
			toast.info("No missing lines in this field.");
			return;
		}
		const line = missing[nextMissing.current % missing.length];
		nextMissing.current += 1;
		focusLine(line.id);
	};

	return (
		<Drawer
			title="Translation & romanization"
			subtitle={`${missingTranslation} missing translations · ${missingRomanization} missing romanizations`}
			onClose={onClose}
			footer={
				<>
					<Button variant="soft" color="gray" onClick={jumpNextMissing}>
						<ArrowRight16Regular /> Next missing
					</Button>
					<Button variant="soft" onClick={onClose}>
						Done
					</Button>
				</>
			}
		>
			{!canEdit ? (
				<Hint>
					Your role can view translations but not edit them. Ask the host for
					editor access.
				</Hint>
			) : null}
			<PaneSection title="Languages">
				<Flex gap="2" wrap="wrap">
					<TextField.Root
						value={translationLanguage}
						onChange={(event) =>
							setTranslationLanguage(event.currentTarget.value)
						}
						placeholder="Translation language code, e.g. en"
						style={{ flex: 1 }}
					/>
					<TextField.Root
						value={romanizationLanguage}
						onChange={(event) =>
							setRomanizationLanguage(event.currentTarget.value)
						}
						placeholder="Romanization language code, e.g. ja-Latn"
						style={{ flex: 1 }}
					/>
				</Flex>
				<Hint>
					Language codes are saved with the project notes. They are not AI
					generation: everything here is typed, imported, or edited by people.
				</Hint>
			</PaneSection>

			<PaneSection title="Text import / export">
				<Flex gap="2" wrap="wrap" align="center">
					<Button variant="soft" color="gray" onClick={exportText}>
						<ArrowDownload16Regular /> Export {field}
					</Button>
					<Button
						variant="soft"
						color="gray"
						onClick={() => fileRef.current?.click()}
					>
						<ArrowUpload16Regular /> Import text
					</Button>
					<Text size="1" color="gray">
						Import into:
					</Text>
					<Button
						size="1"
						variant={importField === "translation" ? "solid" : "soft"}
						onClick={() => setImportField("translation")}
					>
						Translation
					</Button>
					<Button
						size="1"
						variant={importField === "romanization" ? "solid" : "soft"}
						onClick={() => setImportField("romanization")}
					>
						Romanization
					</Button>
				</Flex>
				<input
					ref={fileRef}
					type="file"
					accept=".txt,text/plain"
					style={{ display: "none" }}
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						event.currentTarget.value = "";
						if (file) void importFile(file);
					}}
				/>
				<Hint>
					One line per lyric line, in editor order. The import checks the line
					count and refuses a mismatched file instead of overwriting timing.
				</Hint>
			</PaneSection>

			<PaneSection title="Options">
				<Flex direction="column" gap="2">
					<Flex align="center" gap="2">
						<Checkbox
							checked={missingOnly}
							onCheckedChange={(value) => setMissingOnly(value === true)}
							id="translation-missing-only"
						/>
						<Text as="label" htmlFor="translation-missing-only" size="2">
							Only show missing lines
						</Text>
					</Flex>
					<Flex align="center" gap="2" wrap="wrap">
						<Text size="1" color="gray">
							Field:
						</Text>
						<Button
							size="1"
							variant={field === "translation" ? "solid" : "soft"}
							onClick={() => setField("translation")}
						>
							Translation
						</Button>
						<Button
							size="1"
							variant={field === "romanization" ? "solid" : "soft"}
							onClick={() => setField("romanization")}
						>
							Romanization
						</Button>
					</Flex>
					<Flex align="center" gap="2">
						<Checkbox
							checked={wordMode}
							onCheckedChange={(value) => setWordMode(value === true)}
							id="translation-word-mode"
						/>
						<Text as="label" htmlFor="translation-word-mode" size="2">
							Show per-word romanization fields
						</Text>
						<Badge size="1" variant="soft">
							Display option
						</Badge>
					</Flex>
					<TextField.Root
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search source or translation"
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
				</Flex>
			</PaneSection>

			<PaneSection title={`Lines (${visible.length})`}>
				{visible.length === 0 ? <Hint>No lines match this filter.</Hint> : null}
				<div>
					{visible.map((line) => {
						const index = lines.indexOf(line) + 1;
						const missing =
							field === "translation"
								? !line.translatedLyric.trim()
								: !line.romanLyric.trim();
						return (
							<div key={line.id} className={styles.translationRow}>
								<button
									type="button"
									className={styles.translationIndex}
									onClick={() => focusLine(line.id)}
									style={{
										border: "none",
										background: "transparent",
										cursor: "pointer",
										color: "inherit",
									}}
								>
									{index}
									{missing ? <div className={styles.missing}>●</div> : null}
								</button>
								<div className={styles.translationSource}>
									{line.words.map((word) => word.word).join("") || "(empty)"}
								</div>
								<TextField.Root
									value={line.translatedLyric}
									disabled={!canEdit}
									placeholder={`Translation${translationLanguage ? ` (${translationLanguage})` : ""}`}
									onChange={(event) =>
										updateLine(
											line.id,
											"translatedLyric",
											event.currentTarget.value,
										)
									}
								/>
								<TextField.Root
									value={line.romanLyric}
									disabled={!canEdit}
									placeholder={`Romanization${romanizationLanguage ? ` (${romanizationLanguage})` : ""}`}
									onChange={(event) =>
										updateLine(line.id, "romanLyric", event.currentTarget.value)
									}
								/>
								{wordMode ? (
									<div className={styles.wordGrid}>
										{line.words.map((word) => (
											<div key={word.id} className={styles.wordField}>
												<Text size="1" color="gray" as="div">
													{word.word || "·"}
												</Text>
												<TextField.Root
													size="1"
													value={word.romanWord}
													disabled={!canEdit}
													placeholder="roman"
													onChange={(event) =>
														updateWordRoman(
															line.id,
															word.id,
															event.currentTarget.value,
														)
													}
												/>
											</div>
										))}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</PaneSection>
		</Drawer>
	);
}
