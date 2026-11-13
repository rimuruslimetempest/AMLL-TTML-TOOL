import {
	Dismiss16Regular,
	People16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { collabClient } from "./client";
import { CollabFiles } from "./CollabFiles";
import { CollabHealthHeader } from "./CollabHealthHeader";
import { formatChatTime } from "./logic";
import {
	collabActiveAtom,
	collabChatAtom,
	collabChatOpenAtom,
	collabDialogOpenAtom,
	collabErrorAtom,
	collabPeersAtom,
	collabStatusAtom,
	collabUnreadAtom,
} from "./states";

export function CollabOverlay() {
	const active = useAtomValue(collabActiveAtom);
	const status = useAtomValue(collabStatusAtom);
	const peers = useAtomValue(collabPeersAtom);
	const [open, setOpen] = useAtom(collabChatOpenAtom);
	const setDialogOpen = useSetAtom(collabDialogOpenAtom);
	const [unread, setUnread] = useAtom(collabUnreadAtom);
	const [chat, setChat] = useState("");

	useEffect(() => {
		if (open) setUnread(0);
	}, [open, setUnread]);

	if (!active) return null;

	return (
		<>
			{!open && (
				<Button
					variant="solid"
					onClick={() => {
						setDialogOpen(false);
						setOpen(true);
					}}
					style={{
						position: "fixed",
						left: 16,
						bottom: 16,
						zIndex: 17000,
						borderRadius: 999,
						boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
					}}
				>
					<People16Regular /> Live {peers.length}
					{unread > 0 && (
						<Badge color="red" variant="solid">
							{unread}
						</Badge>
					)}
				</Button>
			)}
			{open && (
				<CollabChatPanel
					status={status}
					peers={peers}
					chat={chat}
					setChat={setChat}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}

function CollabChatPanel({
	status,
	peers,
	chat,
	setChat,
	onClose,
}: {
	status: string;
	peers: { id: string; name: string; color: string }[];
	chat: string;
	setChat: (value: string) => void;
	onClose: () => void;
}) {
	const messages = useAtomValue(collabChatAtom);
	const error = useAtomValue(collabErrorAtom);
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (messages.length > 0) {
			endRef.current?.scrollIntoView({ block: "end" });
		}
	}, [messages.length]);

	const send = () => {
		if (!chat.trim()) return;
		collabClient.sendChat(chat);
		setChat("");
	};

	return (
		<Card
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				width: "min(360px, calc(100vw - 32px))",
				height: "min(500px, calc(100vh - 100px))",
				zIndex: 17001,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				backgroundColor: "var(--color-panel-solid)",
				boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
			}}
		>
			<Flex justify="between" align="center" gap="2" p="2">
				<Flex align="center" gap="2">
					<People16Regular />
					<Text size="2" weight="bold">
						Live room
					</Text>
				</Flex>
				<IconButton
					variant="ghost"
					color="gray"
					aria-label="Close chat"
					onClick={onClose}
				>
					<Dismiss16Regular />
				</IconButton>
			</Flex>
			<CollabHealthHeader compact />
			<Flex px="2" pb="2" gap="1" wrap="wrap">
				{peers.map((peer) => (
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
				))}
			</Flex>
			<CollabFiles />
			<Box
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: "auto",
					padding: "0 10px 8px",
				}}
			>
				{messages.length === 0 ? (
					<Text size="1" color="gray">
						No messages yet. Say hi.
					</Text>
				) : (
					messages.map((message) => {
						const peer = peers.find((entry) => entry.id === message.authorId);
						return (
							<Box
								key={message.id}
								style={{
									padding: "7px 9px",
									marginTop: 6,
									borderRadius: 10,
									background: "var(--gray-a3)",
								}}
							>
								<Flex align="center" gap="2" justify="between">
									<Text
										size="1"
										weight="bold"
										style={{ color: peer?.color ?? "var(--accent-11)" }}
									>
										{message.authorName}
									</Text>
									<Text size="1" color="gray">
										{formatChatTime(message.at)}
									</Text>
								</Flex>
								<Text
									size="2"
									style={{
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
									}}
								>
									{message.text}
								</Text>
							</Box>
						);
					})
				)}
				<div ref={endRef} />
			</Box>
			{error && (
				<Text size="1" color="red" style={{ padding: "0 8px 8px" }}>
					{error}
				</Text>
			)}
			<Flex gap="2" p="2" style={{ borderTop: "1px solid var(--gray-a5)" }}>
				<TextField.Root
					value={chat}
					onChange={(event) => setChat(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							send();
						}
					}}
					placeholder="Message the room..."
					style={{ flex: 1 }}
				/>					<Button
						onClick={send}
						disabled={!chat.trim() || status !== "connected"}
					>
						Send
					</Button>
			</Flex>
		</Card>
	);
}
