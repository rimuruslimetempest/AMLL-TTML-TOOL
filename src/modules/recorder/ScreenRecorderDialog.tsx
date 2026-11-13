import {
	Dismiss16Regular,
	Stop16Regular,
	Video16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	Switch,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
	collabRoleAtom,
	collabSessionAtom,
} from "$/modules/collab/states";
import {
	type RecordingResult,
	saveScreenRecording,
	shareScreenRecording,
	startScreenRecording,
	stopScreenRecording,
} from "./service";
import { screenRecorderDialogOpenAtom } from "./states";

function formatElapsed(milliseconds: number): string {
	const total = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ScreenRecorderDialog() {
	const [open, setOpen] = useAtom(screenRecorderDialogOpenAtom);
	const role = useAtomValue(collabRoleAtom);
	const session = useAtomValue(collabSessionAtom);
	const [recording, setRecording] = useState(false);
	const [busy, setBusy] = useState(false);
	const [startedAt, setStartedAt] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	const [hasAudio, setHasAudio] = useState(false);
	const [result, setResult] = useState<RecordingResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [shareWithRoom, setShareWithRoom] = useState(true);
	const canShare = Boolean(role === "host" && session);

	useEffect(() => {
		if (!recording) return;
		const timer = window.setInterval(
			() => setElapsed(Date.now() - startedAt),
			250,
		);
		return () => window.clearInterval(timer);
	}, [recording, startedAt]);

	const start = async () => {
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const started = await startScreenRecording();
			setStartedAt(started.startedAt);
			setElapsed(0);
			setHasAudio(started.hasAudio);
			setRecording(true);
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setRecording(false);
		} finally {
			setBusy(false);
		}
	};

	const stop = async () => {
		setBusy(true);
		setError(null);
		try {
			const finished = await stopScreenRecording();
			setResult(finished);
			setRecording(false);
			setOpen(true);
			if (canShare && shareWithRoom) {
				try {
					await shareScreenRecording(finished);
					toast.success("Recording shared with the live room.");
				} catch (cause) {
					setError(
						`The recording was saved, but it could not be shared: ${
							cause instanceof Error ? cause.message : String(cause)
						}`,
					);
				}
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setRecording(false);
		} finally {
			setBusy(false);
		}
	};

	const save = async () => {
		if (!result) return;
		try {
			const path = await saveScreenRecording(result);
			if (path) toast.success("Recording saved.");
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : String(cause));
		}
	};

	const shareAgain = async () => {
		if (!result) return;
		try {
			await shareScreenRecording(result);
			toast.success("Recording shared with the live room.");
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : String(cause));
		}
	};

	const changeOpen = (next: boolean) => {
		if (!next && recording) {
			toast.info("Stop the screen recording before closing this window.");
			return;
		}
		setOpen(next);
	};

	return (
		<>
			{recording && !open && (
				<Card
					style={{
						position: "fixed",
						left: "50%",
						bottom: 20,
						transform: "translateX(-50%)",
						zIndex: 18000,
						boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
						border: "1px solid var(--red-a6)",
					}}
				>
					<Flex align="center" gap="3">
						<span
							style={{
								width: 9,
								height: 9,
								borderRadius: "50%",
								background: "#e5484d",
							}}
						/>
						<Text size="2" weight="bold" style={{ fontVariantNumeric: "tabular-nums" }}>
							{formatElapsed(elapsed)}
						</Text>
						<Button size="1" color="red" onClick={() => void stop()} loading={busy}>
							<Stop16Regular /> Stop
						</Button>
					</Flex>
				</Card>
			)}
			<Dialog.Root open={open} onOpenChange={changeOpen}>
			<Dialog.Content style={{ maxWidth: 520 }}>
				<Flex justify="between" align="start" gap="3">
					<Box>
						<Dialog.Title style={{ margin: 0 }}>
							<Flex align="center" gap="2">
								<Video16Regular /> Screen recorder
							</Flex>
						</Dialog.Title>
						<Dialog.Description size="2" color="gray" mt="1">
							Records the whole screen and the song currently loaded in the
							editor. Finished recordings can be saved or shared with the live
							room.
						</Dialog.Description>
					</Box>
					<Dialog.Close disabled={recording}>
						<IconButton variant="ghost" color="gray" aria-label="Close">
							<Dismiss16Regular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				<Card mt="4" size="1" variant="surface">
					{recording ? (
						<Flex direction="column" gap="3" align="center">
							<Flex align="center" gap="2">
								<span
									style={{
										width: 10,
										height: 10,
										borderRadius: "50%",
										background: "#e5484d",
										boxShadow: "0 0 0 5px rgba(229, 72, 77, 0.16)",
									}}
								/>
								<Text size="4" weight="bold" style={{ fontVariantNumeric: "tabular-nums" }}>
									{formatElapsed(elapsed)}
								</Text>
								<Badge color="red">Recording</Badge>
							</Flex>
							<Text size="1" color="gray" align="center">
								{hasAudio
									? "Screen and editor audio are being captured."
									: "Screen is being captured. Load a song before starting to include audio."}
							</Text>
							<Button color="red" onClick={() => void stop()} loading={busy}>
								<Stop16Regular /> Stop recording
							</Button>
						</Flex>
					) : (
						<Flex direction="column" gap="3">
							<Text size="2">
								The recorder captures the entire display, including this
								window. Audio is taken from the loaded song; microphone and
								other system sounds are not included.
							</Text>
							{canShare && (
								<Flex align="center" justify="between" gap="3">
									<Box>
										<Text as="div" size="1" weight="bold">
											Share with live room
										</Text>
										<Text as="div" size="1" color="gray">
											Guests, including people who join later, can download the
											finished recording.
										</Text>
									</Box>
									<Switch
										checked={shareWithRoom}
										onCheckedChange={setShareWithRoom}
										disabled={busy}
									/>
								</Flex>
							)}
							<Button onClick={() => void start()} loading={busy}>
								<Video16Regular /> Start screen recording
							</Button>
						</Flex>
					)}
				</Card>

				{result && (
					<Card mt="3" size="1">
						<Flex direction="column" gap="2">
							<Flex align="center" justify="between" gap="2">
								<Box style={{ minWidth: 0 }}>
									<Text as="div" size="2" weight="bold">
										{result.fileName}
									</Text>
									<Text as="div" size="1" color="gray">
										{formatElapsed(result.durationMs)} · {formatSize(result.size)}
									</Text>
								</Box>
								<Badge color="green">Ready</Badge>
							</Flex>
							<Flex gap="2" wrap="wrap">
								<Button variant="soft" onClick={() => void save()}>
									Save MP4
								</Button>
								{canShare && (
									<Button variant="soft" color="gray" onClick={() => void shareAgain()}>
										Share with room
									</Button>
								)}
							</Flex>
						</Flex>
					</Card>
				)}

				{error && (
					<Text as="div" size="1" color="red" mt="3" style={{ whiteSpace: "pre-wrap" }}>
						{error}
					</Text>
				)}
			</Dialog.Content>
		</Dialog.Root>
		</>
	);
}
