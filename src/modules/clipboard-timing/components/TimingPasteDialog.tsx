import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	ScrollArea,
	Select,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { lyricLinesAtom } from "$/states/main";
import {
	commitTimingPaste,
	isTargetLineLocked,
	relativeStartFor,
} from "../actions";
import { buildPastePreview } from "../logic";
import { clipboardPayloadAtom, timingPasteDialogAtom } from "../states";
import type { PasteMode } from "../types";

export function TimingPasteDialog() {
	const [state, setState] = useAtom(timingPasteDialogAtom);
	const payload = useAtomValue(clipboardPayloadAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const [mode, setMode] = useState<PasteMode>("position");
	const [offset, setOffset] = useState("0");
	const [relative, setRelative] = useState(false);

	useEffect(() => {
		if (!state.open) return;
		setMode(state.mode);
		setRelative(state.relative ?? false);
		setOffset("0");
	}, [state.open, state.mode, state.relative]);

	const target = state.targetLineId
		? lyrics.lyricLines.find((line) => line.id === state.targetLineId)
		: undefined;
	const offsetMs = Number(offset);
	const safeOffset = Number.isFinite(offsetMs) ? Math.round(offsetMs) : 0;
	const locked = target ? isTargetLineLocked(target.id) : false;

	const preview = useMemo(() => {
		if (!target || !payload || payload.kind !== "line-timing") return null;
		return buildPastePreview(target, payload, {
			mode,
			offsetMs: safeOffset,
			relative,
			startAt: relativeStartFor(target.id),
		});
	}, [target, payload, mode, safeOffset, relative]);

	const apply = () => {
		if (!target || !preview) return;
		if (commitTimingPaste(target.id, preview)) {
			setState((current) => ({ ...current, open: false }));
		}
	};

	return (
		<Dialog.Root
			open={state.open}
			onOpenChange={(open) => setState((current) => ({ ...current, open }))}
		>
			<Dialog.Content maxWidth="640px" style={{ width: "min(94vw, 640px)" }}>
				<Dialog.Title>Paste line timing</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					Only timestamps are pasted. Every pasted word is marked for review
					until you confirm it against the audio.
				</Dialog.Description>

				{!payload || payload.kind !== "line-timing" ? (
					<Callout.Root color="amber" mt="3">
						<Callout.Text>
							Copy a line's timing first (Line menu → Copy line timing).
						</Callout.Text>
					</Callout.Root>
				) : !target ? (
					<Callout.Root color="amber" mt="3">
						<Callout.Text>Select the line that should receive the timing.</Callout.Text>
					</Callout.Root>
				) : (
					<Flex direction="column" gap="3" mt="3">
						<Box
							p="2"
							style={{
								background: "var(--gray-3)",
								borderRadius: "var(--radius-2)",
							}}
						>
							<Text size="1" color="gray" as="div">
								From: {payload.text || "(empty line)"}
							</Text>
							<Text size="1" color="gray" as="div">
								To: {target.words.map((word) => word.word).join("")}
							</Text>
						</Box>

						{preview?.mismatch && (
							<Callout.Root color="amber">
								<Callout.Text>
									The source has {preview.sourceCount} word positions and the
									target has {preview.targetCount}. Choose how to fit them;
									nothing is guessed silently.
								</Callout.Text>
							</Callout.Root>
						)}

						{locked && (
							<Callout.Root color="red">
								<Callout.Text>
									Someone else is editing this line right now. Wait for their
									lock to expire before pasting.
								</Callout.Text>
							</Callout.Root>
						)}

						<Flex gap="3" wrap="wrap" align="end">
							<Box style={{ flex: "1 1 190px" }}>
								<Text as="label" size="1" color="gray">
									When word counts differ
								</Text>
								<Select.Root
									value={mode}
									onValueChange={(value) => setMode(value as PasteMode)}
								>
									<Select.Trigger style={{ width: "100%" }} />
									<Select.Content>
										<Select.Item value="position">
											Match by position (extra words stay untimed)
										</Select.Item>
										<Select.Item value="stretch">Stretch to fit</Select.Item>
									</Select.Content>
								</Select.Root>
							</Box>
							<Box style={{ flex: "0 1 130px" }}>
								<Text as="label" size="1" color="gray">
									Offset (ms)
								</Text>
								<TextField.Root
									type="number"
									value={offset}
									onChange={(event) => setOffset(event.target.value)}
								/>
							</Box>
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={relative}
										onCheckedChange={(checked) => setRelative(checked === true)}
									/>
									Paste relative to playhead / line start
								</Flex>
							</Text>
						</Flex>

						{preview && (
							<ScrollArea style={{ maxHeight: "30vh" }}>
								<Flex direction="column" gap="1" pr="2">
									{preview.rows.slice(0, 60).map((row) => (
										<Flex
											key={row.wordId}
											gap="2"
											align="center"
											justify="between"
											style={{ fontSize: 12 }}
										>
											<Text size="1" style={{ minWidth: 80 }}>
												{row.text.trim() || "␣"}
											</Text>
											<Text size="1" color="gray">
												{row.endTime > row.startTime
													? `${(row.startTime / 1000).toFixed(3)} → ${(row.endTime / 1000).toFixed(3)}`
													: "stays untimed"}
											</Text>
										</Flex>
									))}
									{preview.rows.length > 60 && (
										<Text size="1" color="gray">
											…and {preview.rows.length - 60} more words.
										</Text>
									)}
								</Flex>
							</ScrollArea>
						)}
					</Flex>
				)}

				<Flex justify="end" gap="2" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							Cancel
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={!preview || !target || locked}>
						Paste timing
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
