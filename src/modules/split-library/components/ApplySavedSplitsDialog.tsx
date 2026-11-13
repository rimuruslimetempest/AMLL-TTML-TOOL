import { Box, Button, Callout, Dialog, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { can } from "$/modules/collab/permissions";
import {
	collabActiveAtom,
	collabLocksAtom,
	collabRoleAtom,
	collabSelfIdAtom,
} from "$/modules/collab/states";
import { lyricLinesAtom } from "$/states/main";
import { applySavedSplitPreview, buildSavedSplitPreview } from "../logic";
import { applySavedSplitsDialogAtom, splitLibraryAtom } from "../states";

/** Hard cap keeps a 3000-line song responsive; the rest can be run again. */
const MAX_ROWS = 200;

export function ApplySavedSplitsDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(applySavedSplitsDialogAtom);
	const library = useAtomValue(splitLibraryAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const locks = useAtomValue(collabLocksAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const active = useAtomValue(collabActiveAtom);
	const role = useAtomValue(collabRoleAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const allowed = !active || can(role, "editTiming");

	const { previews, skipped } = useMemo(() => {
		if (!open) return { previews: [], skipped: 0 };
		const blocked = new Set(
			locks
				.filter((lock) => lock.clientId !== selfId && lock.expiresAt > Date.now())
				.map((lock) => lock.lineId),
		);
		return buildSavedSplitPreview(lyrics.lyricLines, library.patterns, blocked);
	}, [open, lyrics.lyricLines, library.patterns, locks, selfId]);

	const apply = () => {
		if (!allowed || previews.length === 0) return;
		const count = previews.length;
		editLyricLines((state) => {
			applySavedSplitPreview(state.lyricLines, previews, library.patterns);
		});
		setOpen(false);
		toast.success(
			t("splitLibrary.appliedCount", {
				count,
				defaultValue: `${count} word${count === 1 ? "" : "s"} split. Timed parts are marked for review.`,
			}),
		);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="680px" style={{ width: "min(94vw, 680px)" }}>
				<Dialog.Title>
					{t("splitLibrary.applyAllTitle", "Apply saved splits to the whole song")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{t(
						"splitLibrary.applyAllDescription",
						"This only divides words that have a saved split. Nothing is applied automatically until you confirm.",
					)}
				</Dialog.Description>

				{!allowed && (
					<Callout.Root color="amber" mt="3">
						<Callout.Text>
							{t(
								"splitLibrary.noPermission",
								"Your role in this room cannot change timing. Ask the host for editor access.",
							)}
						</Callout.Text>
					</Callout.Root>
				)}

				<Flex direction="column" gap="2" mt="3">
					<Flex gap="2" align="center" wrap="wrap">
						<Text size="2" weight="medium">
							{t("splitLibrary.changes", {
								count: previews.length,
								defaultValue: `${previews.length} word${previews.length === 1 ? "" : "s"} will be split`,
							})}
						</Text>
						{skipped > 0 && (
							<Text size="1" color="gray">
								{t("splitLibrary.skippedWords", {
									count: skipped,
									defaultValue: `${skipped} word(s) on locked lines were skipped.`,
								})}
							</Text>
						)}
						{library.patterns.length === 0 && (
							<Text size="1" color="gray">
								{t(
									"splitLibrary.applyAllEmpty",
									"Your library is empty. Save a split from the Split Word dialog first.",
								)}
							</Text>
						)}
					</Flex>

					{previews.length > 0 && (
						<ScrollArea style={{ maxHeight: "42vh" }}>
							<Flex direction="column" gap="1" pr="2">
								{previews.slice(0, MAX_ROWS).map((preview) => (
									<Box
										key={`${preview.wordId}-${preview.patternId}`}
										p="2"
										style={{
											background: "var(--gray-3)",
											borderRadius: "var(--radius-2)",
										}}
									>
										<Flex gap="2" align="center" wrap="wrap">
											<Text size="1" color="gray" style={{ minWidth: 54 }}>
												{t("splitLibrary.lineNumber", {
													number: preview.lineIndex + 1,
													defaultValue: `Line ${preview.lineIndex + 1}`,
												})}
											</Text>
											<Text size="2">{preview.current}</Text>
											<Text size="2" color="gray">
												→
											</Text>
											<Text size="2" weight="medium">
												{preview.next}
											</Text>
											{preview.patternLabel !== preview.next && (
												<Text size="1" color="gray">
													{preview.patternLabel}
												</Text>
											)}
										</Flex>
									</Box>
								))}
								{previews.length > MAX_ROWS && (
									<Text size="1" color="gray">
										{t("splitLibrary.moreRows", {
											count: previews.length - MAX_ROWS,
											defaultValue: `…and ${previews.length - MAX_ROWS} more. All of them will be applied.`,
										})}
									</Text>
								)}
							</Flex>
						</ScrollArea>
					)}
				</Flex>

				<Flex justify="end" gap="2" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={!allowed || previews.length === 0}>
						{t("splitLibrary.applyAll", "Apply these splits")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
