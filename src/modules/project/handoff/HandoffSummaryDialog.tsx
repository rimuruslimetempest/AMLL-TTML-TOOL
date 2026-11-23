import {
	ClipboardPaste20Regular,
	DocumentArrowDown20Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Callout,
	Dialog,
	Flex,
	Heading,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { loadedAudioFileNameAtom } from "$/modules/audio/states";
import { syncTimeOffsetAtom } from "$/modules/settings/states/sync";
import { handoffSummaryDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import { buildHandoffSummary } from "./summary";

const toSuggestedName = (fileName: string) => {
	const base = (fileName || "project")
		.replace(/\.ttml$/i, "")
		.replace(/[\\/:*?"<>|]+/g, "-")
		.trim();
	return `${base || "project"}-handoff.md`;
};

export const HandoffSummaryDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(handoffSummaryDialogAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const audioFileName = useAtomValue(loadedAudioFileNameAtom);
	const syncTimeOffset = useAtomValue(syncTimeOffsetAtom);
	const [saving, setSaving] = useState(false);

	const markdown = useMemo(
		() =>
			buildHandoffSummary({
				lyric,
				fileName: saveFileName,
				audioFileName,
				syncTimeOffset,
			}),
		[lyric, saveFileName, audioFileName, syncTimeOffset],
	);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(markdown);
			toast.success(t("handoff.copied", "Hand-off summary copied."));
		} catch {
			toast.error(
				t(
					"handoff.copyFailed",
					"Could not copy automatically. Select the text and copy it.",
				),
			);
		}
	};

	const save = async () => {
		setSaving(true);
		try {
			const saved = await saveFile(markdown, {
				suggestedName: toSuggestedName(saveFileName),
				types: [
					{
						description: "Markdown",
						accept: { "text/markdown": [".md"] },
					},
				],
			});
			if (saved) {
				toast.success(
					t("handoff.saved", "Saved {{name}}", { name: saved }),
				);
			}
		} catch (error) {
			toast.error(
				t("handoff.saveFailed", "Could not save the hand-off summary."),
			);
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="720px" style={{ maxHeight: "86vh" }}>
				<Dialog.Title>
					{t("handoff.title", "Hand-off summary")}
				</Dialog.Title>
				<Dialog.Description size="1" color="gray" mb="3">
					{t(
						"handoff.description",
						"A Markdown snapshot of the project for whoever picks it up next: timing coverage, structure, and open items.",
					)}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<Callout.Root size="1" color="gray">
						<Callout.Text>
							{t(
								"handoff.privacy",
								"This summary is generated locally from the open project. Nothing is uploaded.",
							)}
						</Callout.Text>
					</Callout.Root>

					<Heading size="3">
						{t("handoff.preview", "Preview")}
					</Heading>
					<TextArea
						value={markdown}
						readOnly
						aria-label={t("handoff.preview", "Preview")}
						style={{
							minHeight: "300px",
							maxHeight: "46vh",
							fontFamily: "var(--code-font-family, monospace)",
							fontSize: "12px",
							lineHeight: 1.55,
						}}
					/>
					<Text size="1" color="gray">
						{t(
							"handoff.previewHint",
							"Copy it into a ticket, a pull request, or a message to your collaborator.",
						)}
					</Text>
				</Flex>

				<Flex gap="3" mt="4" justify="end" wrap="wrap">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
					<Button variant="soft" onClick={copy}>
						<ClipboardPaste20Regular />
						{t("handoff.copy", "Copy Markdown")}
					</Button>
					<Button onClick={save} loading={saving}>
						<DocumentArrowDown20Regular />
						{t("handoff.save", "Save .md")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};

export default HandoffSummaryDialog;
