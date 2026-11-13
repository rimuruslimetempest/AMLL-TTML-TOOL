import { People16Regular } from "@fluentui/react-icons";
import {
	Button,
	Card,
	Flex,
	Heading,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { PrivacyConsentLinks } from "$/modules/privacy/PrivacyDialogs";
import {
	privacyPolicyDialogAtom,
	privacyPromptAtom,
	termsDialogAtom,
} from "$/modules/privacy/states";
import { usePrivacyGate } from "$/modules/privacy/usePrivacyGate";
import { collabClient } from "./client";
import {
	getCollabRoomFromLocation,
	randomCollabName,
	sanitizeCollabName,
} from "./logic";
import {
	collabActiveAtom,
	collabChatOpenAtom,
	collabErrorAtom,
	collabNameAtom,
	collabStatusAtom,
} from "./states";

export function CollabJoinGate() {
	const room = useMemo(
		() => getCollabRoomFromLocation(window.location.search),
		[],
	);
	const [name, setName] = useAtom(collabNameAtom);
	const [chatOpen, setChatOpen] = useAtom(collabChatOpenAtom);
	const status = useAtomValue(collabStatusAtom);
	const active = useAtomValue(collabActiveAtom);
	const error = useAtomValue(collabErrorAtom);
	const privacyPrompt = useAtomValue(privacyPromptAtom);
	const privacyPolicyOpen = useAtomValue(privacyPolicyDialogAtom);
	const termsOpen = useAtomValue(termsDialogAtom);
	const requestConsent = usePrivacyGate();
	const [dismissed, setDismissed] = useState(false);
	const [password, setPassword] = useState("");
	const inviteCode = useMemo(
		() => new URLSearchParams(window.location.search).get("invite") ?? undefined,
		[],
	);

	useEffect(() => {
		if (!name) setName(randomCollabName());
	}, [name, setName]);

	if (!room || active || dismissed || privacyPrompt || privacyPolicyOpen || termsOpen)
		return null;

	const joining = status === "connecting" || status === "starting";

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 19000,
				display: "grid",
				placeItems: "center",
				background: "rgba(0, 0, 0, 0.62)",
				backdropFilter: "blur(8px)",
				padding: 16,
			}}
		>
			<Card style={{ width: "min(440px, 100%)", padding: 20 }}>
				<Flex direction="column" gap="3">
					<Flex align="center" gap="2">
						<People16Regular />
						<Heading size="5">Join live TTML</Heading>
					</Flex>
					<Text size="2" color="gray">
						You were invited to edit a TTML together. Changes, chat, and
						shared media sync live.
					</Text>
					<Text size="1" color="gray">
						Room {room}
					</Text>
					<Text size="1" color="gray">
						The host and guests can see your name, edits, chat, and shared
						media. Only join rooms you trust.
					</Text>
					<TextField.Root
						value={name}
						onChange={(event) =>
							setName(sanitizeCollabName(event.currentTarget.value))
						}
						placeholder="Your display name"
					/>
					{inviteCode ? (
						<>
							<Text size="1" color="gray">
								Enter the invite password if the host set one. The host may need
								to approve you.
							</Text>
							<TextField.Root
								type="password"
								value={password}
								onChange={(event) => setPassword(event.currentTarget.value)}
								placeholder="Invite password (if one was set)"
							/>
						</>
					) : null}
					<Button
						onClick={() =>
							requestConsent(
								"live",
								() => {
									collabClient.joinGuest(room, name, {
										inviteCode,
										password: password.trim() || undefined,
									});
									setChatOpen(true);
								},
								"Joining a room sends your display name, edits, chat, song info, and shared split suggestions to the host and everyone in the room.",
							)
						}
						disabled={joining || !name.trim()}
					>
						{joining ? <Spinner size="1" /> : <People16Regular />}
						{joining ? "Connecting..." : "Join room"}
					</Button>
					{error && (
						<Text size="1" color="red">
							{error}
						</Text>
					)}
					<PrivacyConsentLinks />
					<Button
						variant="ghost"
						color="gray"
						onClick={() => setDismissed(true)}
					>
						Open without joining
					</Button>
					{!chatOpen && (
						<Text size="1" color="gray">
							The chat panel opens after you join.
						</Text>
					)}
				</Flex>
			</Card>
		</div>
	);
}
