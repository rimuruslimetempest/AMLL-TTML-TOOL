import {
	Checkbox,
	Dialog,
	Flex,
	Select,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { uid } from "uid";
import {
	confirmDialogAtom,
	formatExportDialogAtom,
	formatImportDialogAtom,
} from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import { openFileWithDialog } from "$/utils/fileDialog";
import {
	exportLyrics,
	type LyricExportOptions,
} from "./exporters";
import { parsedResultToTTML } from "./import";
import {
	decodeLyricBytes,
	type LyricFormat,
	type ParseResult,
	parseLyricText,
} from "./parsers";
import styles from "./FormatDialogs.module.css";

const OPEN_FILTERS = [
	{
		name: "Lyric files",
		extensions: ["lrc", "srt", "ass", "ssa", "vtt", "txt"],
	},
];

export function FormatImportDialog() {
	const [open, setOpen] = useAtom(formatImportDialogAtom);
	const [result, setResult] = useState<ParseResult | null>(null);
	const [fileName, setFileName] = useState("");
	const [encoding, setEncoding] = useState("");
	const [busy, setBusy] = useState(false);
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);

	const chooseFile = async () => {
		setBusy(true);
		try {
			const selected = await openFileWithDialog({
				filters: OPEN_FILTERS,
				multiple: false,
			});
			const file = Array.isArray(selected) ? selected[0] : selected;
			if (!file) return;
			const decoded = decodeLyricBytes(await file.arrayBuffer());
			const parsed = parseLyricText(file.name, decoded.text);
			setResult(parsed);
			setFileName(file.name);
			setEncoding(decoded.encoding);
		} catch {
			toast.error("The lyric file could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const applyImport = useCallback(() => {
		if (!result) return;
		setNewLyricLines(parsedResultToTTML(result));
		setProjectId(uid());
		setSaveFileName(fileName.replace(/\.[^.]+$/, "") + ".ttml");
		setOpen(false);
		toast.info(
			"Imported timing needs to be checked against the audio. Imported words are marked for review.",
			{ autoClose: 10000 },
		);
	}, [result, fileName, setNewLyricLines, setProjectId, setSaveFileName, setOpen]);

	const requestImport = () => {
		if (!result) return;
		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: "Replace the current project?",
				description:
					"The imported lyrics will replace the current project. Unsaved changes will be lost.",
				confirmText: "Import",
				onConfirm: applyImport,
			});
			return;
		}
		applyImport();
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setResult(null);
			}}
		>
			<Dialog.Content maxWidth="620px">
				<Dialog.Title>Import timed lyrics</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					LRC, enhanced LRC, SRT, ASS/SSA, VTT, or plain text. Nothing is
					imported until you review the preview and choose Import.
				</Dialog.Description>

				<Flex direction="column" gap="3" mt="4">
					<Flex gap="2" align="center">
						<TextField.Root
							value={fileName || "No file selected"}
							readOnly
							style={{ flex: 1 }}
						/>
						<button
							type="button"
							className={styles.chooseButton}
							onClick={chooseFile}
							disabled={busy}
						>
							{busy ? "Reading…" : "Choose file…"}
						</button>
					</Flex>

					{result ? (
						<>
							<Flex gap="2" wrap="wrap">
								<Text size="2">
									Detected format: <strong>{result.formatLabel}</strong>
								</Text>
								<Text size="2" color="gray">
									{result.lines.length} line
									{result.lines.length === 1 ? "" : "s"} · {encoding}
								</Text>
								<Text size="2" color="gray">
									{result.hasWordTiming
										? "Word timing found"
										: "Line timing only"}
								</Text>
							</Flex>

							<pre className={styles.preview}>
								{result.lines
									.slice(0, 8)
									.map(
										(line) =>
											`${line.startTime ? `${(line.startTime / 1000).toFixed(2)}s` : "untimed"}  ${line.text}`,
									)
									.join("\n")}
							</pre>

							{result.warnings.length > 0 ? (
								<div className={styles.warnings}>
									<strong>Problems found:</strong>
									<ul>
										{result.warnings.slice(0, 8).map((warning) => (
											<li key={warning}>{warning}</li>
										))}
									</ul>
								</div>
							) : (
								<Text size="2" color="green">
									No bad lines were found.
								</Text>
							)}

							<Text size="1" color="gray">
								Imported timing is a starting point only. Every imported line
								will be marked needs review; nothing is retimed automatically.
							</Text>
						</>
					) : (
						<Text size="2" color="gray">
							Choose a lyric file to see its detected format, line count, and
							timestamp problems before importing.
						</Text>
					)}
				</Flex>

				<Flex gap="2" justify="end" mt="4">
					<Dialog.Close>
						<button type="button" className={styles.secondaryButton}>
							Cancel
						</button>
					</Dialog.Close>
					<button
						type="button"
						className={styles.primaryButton}
						disabled={!result || result.lines.length === 0}
						onClick={requestImport}
					>
						Import
					</button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function FormatExportDialog() {
	const [open, setOpen] = useAtom(formatExportDialogAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const [format, setFormat] = useState<LyricFormat>("lrc");
	const [fileName, setFileName] = useState("");
	const [options, setOptions] = useState<LyricExportOptions>({
		includeTranslation: true,
		includeRomanization: true,
		includeBackground: true,
	});

	const result = useMemo(
		() => exportLyrics(lyric, format, options),
		[lyric, format, options],
	);

	useEffect(() => {
		if (!open) return;
		const base = saveFileName.replace(/\.[^.]+$/, "") || "lyrics";
		setFileName(`${base}.${result.extension}`);
	}, [open, saveFileName, result.extension]);

	const doExport = async () => {
		if (!result.content.trim()) {
			toast.error("There is no lyric text to export.");
			return;
		}
		try {
			const saved = await saveFile(result.content, {
				suggestedName: fileName || `lyrics.${result.extension}`,
				types: [
					{
						description: `${result.formatLabel} files`,
						accept: { "text/plain": [`.${result.extension}`] },
					},
				],
			});
			if (saved) {
				toast.success(`Exported ${saved}`);
				setOpen(false);
			}
		} catch {
			toast.error("The export could not be saved.");
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="620px">
				<Dialog.Title>Export lyrics</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					This exports a copy. Your project is never changed.
				</Dialog.Description>

				<Flex direction="column" gap="3" mt="4">
					<Flex gap="2" align="center" wrap="wrap">
						<Text size="2">Format</Text>
						<Select.Root
							value={format}
							onValueChange={(value) => setFormat(value as LyricFormat)}
						>
							<Select.Trigger style={{ minWidth: 210 }} />
							<Select.Content>
								<Select.Item value="lrc">LRC (line timing)</Select.Item>
								<Select.Item value="eslrc">
									Enhanced LRC (word timing)
								</Select.Item>
								<Select.Item value="srt">SRT subtitles</Select.Item>
								<Select.Item value="plain">Plain text</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>

					<Flex gap="3" wrap="wrap">
						<Text as="label" size="2">
							<Checkbox
								checked={options.includeTranslation}
								onCheckedChange={(checked) =>
									setOptions((current) => ({
										...current,
										includeTranslation: checked === true,
									}))
								}
							/>{" "}
							Translation
						</Text>
						<Text as="label" size="2">
							<Checkbox
								checked={options.includeRomanization}
								onCheckedChange={(checked) =>
									setOptions((current) => ({
										...current,
										includeRomanization: checked === true,
									}))
								}
							/>{" "}
							Romanization
						</Text>
						<Text as="label" size="2">
							<Checkbox
								checked={options.includeBackground}
								onCheckedChange={(checked) =>
									setOptions((current) => ({
										...current,
										includeBackground: checked === true,
									}))
								}
							/>{" "}
							Background vocals
						</Text>
					</Flex>

					<TextField.Root
						value={fileName}
						onChange={(event) => setFileName(event.target.value)}
						placeholder={`lyrics.${result.extension}`}
					/>

					<div>
						<Text size="2" weight="bold">
							Preview
						</Text>
						<pre className={styles.preview}>
							{result.content.split("\n").slice(0, 12).join("\n") ||
								"No lyric text"}
						</pre>
					</div>

					<div className={styles.warnings}>
						<strong>What this format cannot keep:</strong>
						<ul>
							{result.losses.map((loss) => (
								<li key={loss}>{loss}</li>
							))}
						</ul>
					</div>
				</Flex>

				<Flex gap="2" justify="end" mt="4">
					<Dialog.Close>
						<button type="button" className={styles.secondaryButton}>
							Cancel
						</button>
					</Dialog.Close>
					<button
						type="button"
						className={styles.primaryButton}
						onClick={doExport}
					>
						Export
					</button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
