import {
	Copy16Regular,
	Dismiss16Regular,
	Open16Regular,
	People16Regular,
	Stop16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	SegmentedControl,
	Separator,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { PrivacyConsentLinks } from "$/modules/privacy/PrivacyDialogs";
import { usePrivacyGate } from "$/modules/privacy/usePrivacyGate";
import { openExternal } from "$/utils/openExternal";
import { CollabFiles } from "./CollabFiles";
import { CollabHealthHeader } from "./CollabHealthHeader";
import { collabClient } from "./client";
import {
	parseCollabInviteLink,
	randomCollabName,
	sanitizeCollabName,
} from "./logic";
import { shareCurrentAudio } from "./share";
import {
	collabChatOpenAtom,
	collabDialogOpenAtom,
	collabErrorAtom,
	collabNameAtom,
	collabPeersAtom,
	collabRoleAtom,
	collabSessionAtom,
	collabStatusAtom,
} from "./states";

export function CollabDialog() {
	const [open, setOpen] = useAtom(collabDialogOpenAtom);
	const [name, setName] = useAtom(collabNameAtom);
	const session = useAtomValue(collabSessionAtom);
	const status = useAtomValue(collabStatusAtom);
	const role = useAtomValue(collabRoleAtom);
	const error = useAtomValue(collabErrorAtom);
	const peers = useAtomValue(collabPeersAtom);
	const setChatOpen = useSetAtom(collabChatOpenAtom);
	const setError = useSetAtom(collabErrorAtom);
	const requestConsent = usePrivacyGate();
	const [starting, setStarting] = useState(false);
	const [sharingSong, setSharingSong] = useState(false);
	const [remote, setRemote] = useState(true);
	const [mode, setMode] = useState<"host" | "join">("host");
	const [joinLink, setJoinLink] = useState("");
	const [joinPassword, setJoinPassword] = useState("");
	const desktop = isTauri();
	const hostSession = session && role === "host" ? session : null;
	const guestSession = session && role !== "host" ? session : null;

	useEffect(() => {
		if (!name) setName(randomCollabName());
	}, [name, setName]);

	const parsedJoin = useMemo(() => {
		const value = joinLink.trim();
		if (!value) return null;
		try {
			return parseCollabInviteLink(value);
		} catch {
			return null;
		}
	}, [joinLink]);

	const startRoom = async () => {
		setStarting(true);
		try {
			await collabClient.startHost(name, remote);
		} catch {
			// The client exposes the actionable error through collabErrorAtom.
		} finally {
			setStarting(false);
		}
	};

	const start = () =>
		requestConsent(
			"live",
			() => void startRoom(),
			"Starting a room sends your project, song info, shared split suggestions, display name, chat, and any shared media to the host server and everyone in the room.",
		);

	const joinRoom = () => {
		try {
			collabClient.joinGuestFromLink(joinLink, name, {
				password: joinPassword.trim() || undefined,
			});
		} catch {
			// The client exposes the actionable error through collabErrorAtom.
		}
	};

	const join = () =>
		requestConsent(
			"live",
			joinRoom,
			"Joining loads the host's project and song info into this window and sends your display name, edits, chat, and shared split suggestions to everyone in the room.",
		);

	const copyLink = async () => {
		if (!session) return;
		try {
			await navigator.clipboard.writeText(session.url);
			toast.success("Invite link copied.");
		} catch {
			toast.error("Could not copy the invite link.");
		}
	};

	const shareSong = async () => {
		setSharingSong(true);
		try {
			await shareCurrentAudio();
			toast.success("Song audio shared with the room.");
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setSharingSong(false);
		}
	};

	const stop = () => {
		const wasGuest = role !== "host";
		collabClient.stop();
		setOpen(false);
		toast.info(wasGuest ? "Left the live room." : "Live room closed.");
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 520 }}>
				<Flex justify="between" align="start" gap="3">
					<Box>
						<Dialog.Title style={{ margin: 0 }}>
							<Flex align="center" gap="2">
								<People16Regular />
								Live collaboration
							</Flex>
						</Dialog.Title>
						<Dialog.Description size="2" color="gray" mt="1">
							Edit this TTML together in real time.
						</Dialog.Description>
					</Box>
					<Dialog.Close>
						<IconButton variant="ghost" color="gray" aria-label="Close">
							<Dismiss16Regular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				{!desktop ? (
					<Card mt="4" size="1">
						<Flex direction="column" gap="2">
							<Text size="2">
								You are viewing the browser edition. To host, use the TTML
								Editor desktop app. To join, open an invite link from the host.
							</Text>
						</Flex>
					</Card>
				) : hostSession ? (
					<Flex direction="column" gap="3" mt="4">
						<Flex align="center" gap="2" wrap="wrap">
							<Badge color="green">Room live</Badge>
							{hostSession.remote && (
								<Badge color="blue">Cloudflare tunnel</Badge>
							)}
							<Badge color="gray">
								{peers.length} {peers.length === 1 ? "person" : "people"}
							</Badge>
						</Flex>
						<CollabHealthHeader compact />
						<Box>
							<Text size="1" weight="bold">
								Connected users ({peers.length})
							</Text>
							<Flex gap="1" wrap="wrap" mt="1">
								{peers.length === 0 ? (
									<Text size="1" color="gray">
										Only you are connected.
									</Text>
								) : (
									peers.map((peer) => (
										<Badge key={peer.id} size="1" variant="soft">
											<span
												style={{
													width: 6,
													height: 6,
													borderRadius: "50%",
													background: peer.color,
													display: "inline-block",
													marginRight: 4,
												}}
											/>
											{peer.name}
										</Badge>
									))
								)}
							</Flex>
						</Box>
						<Box>
							<Text size="1" weight="bold">
								Invite link
							</Text>
							<TextField.Root
								readOnly
								value={hostSession.url}
								mt="1"
								style={{ width: "100%" }}
							/>
							<Text as="div" size="1" color="gray" mt="1">
								Another TTML Tool user can paste this under Collaborate → Join
								a room. It also opens in a browser.
							</Text>
						</Box>
						<Flex gap="2" wrap="wrap">
							<Button variant="soft" onClick={copyLink}>
								<Copy16Regular /> Copy link
							</Button>
							<Button
								variant="soft"
								color="gray"
								onClick={() => void openExternal(hostSession.url)}
							>
								<Open16Regular /> Open in browser
							</Button>
							<Button
								variant="soft"
								color="gray"
								onClick={() => {
									setChatOpen(true);
									setOpen(false);
								}}
							>
								<People16Regular /> Chat
							</Button>
							<Button
								variant="soft"
								color="gray"
								loading={sharingSong}
								onClick={() => void shareSong()}
							>
								Share song audio
							</Button>
							<Button variant="soft" color="red" onClick={stop}>
								<Stop16Regular /> Stop room
							</Button>
						</Flex>
						{error && (
							<Text size="1" color="red">
								{error}
							</Text>
						)}
						<Separator />
						<CollabFiles showEmpty />
						<Text size="1" color="gray">
							{hostSession.remote
								? "Public Cloudflare link. Anyone with it can edit while the room is open."
								: "Local network only. Keep this app open while guests are connected."}
						</Text>
					</Flex>
				) : guestSession ? (
					<Flex direction="column" gap="3" mt="4">
						<Flex align="center" gap="2" wrap="wrap">
							<Badge color="green">In live room</Badge>
							{guestSession.remote && <Badge color="blue">Cloudflare</Badge>}
							<Badge color="gray">
								{peers.length} {peers.length === 1 ? "person" : "people"}
							</Badge>
						</Flex>
						<CollabHealthHeader compact />
						<Box>
							<Text size="1" weight="bold">
								Connected users ({peers.length})
							</Text>
							<Flex gap="1" wrap="wrap" mt="1">
								{peers.length === 0 ? (
									<Text size="1" color="gray">
										Waiting for the room list…
									</Text>
								) : (
									peers.map((peer) => (
										<Badge key={peer.id} size="1" variant="soft">
											<span
												style={{
													width: 6,
													height: 6,
													borderRadius: "50%",
													background: peer.color,
													display: "inline-block",
													marginRight: 4,
												}}
											/>
											{peer.name}
										</Badge>
									))
								)}
							</Flex>
						</Box>
						<Text size="2">
							You joined as <strong>{name}</strong>. Shared songs and files
							load automatically.
						</Text>
						<CollabFiles showEmpty />
						<Flex gap="2" wrap="wrap">
							<Button
								variant="soft"
								color="gray"
								onClick={() => {
									setChatOpen(true);
									setOpen(false);
								}}
							>
								<People16Regular /> Chat
							</Button>
							<Button variant="soft" color="red" onClick={stop}>
								<Stop16Regular /> Leave room
							</Button>
						</Flex>
						{error && (
							<Text size="1" color="red">
								{error}
							</Text>
						)}
						<Text size="1" color="gray">
							The host and other guests can see your name, edits, chat, and
							shared media.
						</Text>
					</Flex>
				) : (
					<Flex direction="column" gap="3" mt="4">
						<Box>
							<Text size="1" weight="bold">
								Your display name
							</Text>
							<TextField.Root
								value={name}
								onChange={(event) =>
									setName(sanitizeCollabName(event.currentTarget.value))
								}
								placeholder="e.g. Alex"
								mt="1"
							/>
						</Box>

						<SegmentedControl.Root
							value={mode}
							onValueChange={(value) => {
								setMode(value as "host" | "join");
								setError(null);
							}}
							size="2"
						>
							<SegmentedControl.Item value="host">
								Host a room
							</SegmentedControl.Item>
							<SegmentedControl.Item value="join">
								Join a room
							</SegmentedControl.Item>
						</SegmentedControl.Root>

						{mode === "join" ? (
							<Flex direction="column" gap="3">
								<Box>
									<Text size="1" weight="bold">
										Room invite link
									</Text>
									<TextField.Root
										value={joinLink}
										onChange={(event) => {
											setJoinLink(event.currentTarget.value);
											setError(null);
										}}
										placeholder="https://…/?collabRoom=…"
										mt="1"
									/>
									<Text as="div" size="1" color="gray" mt="1">
										Paste the full link from the host.
									</Text>
								</Box>
								{parsedJoin ? (
									<Flex gap="1" wrap="wrap">
										<Badge color="blue" size="1">
											Room {parsedJoin.room}
										</Badge>
										{parsedJoin.inviteCode ? (
											<Badge color="green" size="1">
												Invite detected
											</Badge>
										) : null}
									</Flex>
								) : null}
								<Box>
									<Text size="1" weight="bold">
										Invite password
									</Text>
									<TextField.Root
										type="password"
										value={joinPassword}
										onChange={(event) =>
											setJoinPassword(event.currentTarget.value)
										}
										placeholder="Only if the host set one"
										mt="1"
									/>
								</Box>
								<Text size="1" color="gray">
									Joining replaces this window's project with the host's live
									project.
								</Text>
								<Button
									onClick={join}
									disabled={!name.trim() || !joinLink.trim()}
								>
									<People16Regular /> Join in app
								</Button>
							</Flex>
						) : (
							<>
								<Card size="1" variant="surface">
									<Flex align="center" justify="between" gap="3">
										<Box>
											<Text as="div" size="1" weight="bold">
												Hide my IP with Cloudflare
											</Text>
											<Text as="div" size="1" color="gray">
												Creates a temporary public link. Off shares on your local
												network only.
											</Text>
										</Box>
										<Switch
											checked={remote}
											onCheckedChange={setRemote}
											disabled={starting || status === "starting"}
										/>
									</Flex>
								</Card>
								<Card size="1" variant="surface">
									<Text as="div" size="1" weight="bold">
										Room visibility
									</Text>
									<Text as="div" size="1" color="gray">
										Anyone with the link can join and edit while the room is
										open.
									</Text>
								</Card>
								<Button
									onClick={start}
									loading={starting || status === "starting"}
									disabled={!name.trim()}
								>
									<People16Regular /> Start live room
								</Button>
								{(starting || status === "starting") && (
									<Text size="1" color="gray">
										{remote
											? "Starting the room and Cloudflare tunnel…"
											: "Starting the local room…"}
									</Text>
								)}
								<Text size="1" color="gray">
									The room shares lyrics, timing, metadata, sections, marks,
									song info, and chat. Shared splits are suggestions and are
									never applied automatically.
								</Text>
							</>
						)}
						{error && (
							<Text size="1" color="red">
								{error}
							</Text>
						)}
						<PrivacyConsentLinks />
					</Flex>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
