import {
	CheckmarkCircle16Filled,
	Circle16Regular,
	Clock16Regular,
	Warning16Filled,
} from "@fluentui/react-icons";
import { Badge, Box, Button, Flex, Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { globalStore } from "$/states/store";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { collabRoleAtom } from "./states";
import type { CollabMember, CollabRole, ReviewStatus } from "./types";
import styles from "./collab-ui.module.css";

export function focusLine(lineId: string): void {
	const line = globalStore
		.get(lyricLinesAtom)
		.lyricLines.find((item) => item.id === lineId);
	if (!line) return;
	globalStore.set(selectedLinesAtom, new Set([lineId]));
	globalStore.set(selectedWordsAtom, new Set());
	window.dispatchEvent(
		new CustomEvent("ttml:focus-line", { detail: { lineId } }),
	);
}

export function useSelfRole(): CollabRole | null {
	return useAtomValue(collabRoleAtom);
}

export const ROLE_TONE: Record<
	CollabRole,
	"red" | "amber" | "blue" | "gray"
> = {
	host: "red",
	editor: "blue",
	commenter: "amber",
	viewer: "gray",
};

export function RoleBadge({ role }: { role: CollabRole | null }) {
	if (!role) return null;
	return (
		<Badge size="1" variant="soft" color={ROLE_TONE[role]}>
			{role === "host"
				? "Host"
				: role === "editor"
					? "Editor"
					: role === "commenter"
						? "Commenter"
						: "Viewer"}
		</Badge>
	);
}

export function AvatarDot({
	member,
	size = 22,
}: {
	member: Pick<CollabMember, "name" | "color">;
	size?: number;
}) {
	return (
		<span
			className={styles.avatar}
			style={{
				width: size,
				height: size,
				background: member.color || "var(--accent-9)",
				fontSize: Math.round(size * 0.48),
			}}
			title={member.name}
		>
			{member.name.trim().slice(0, 1).toUpperCase() || "?"}
		</span>
	);
}

export function formatWhen(at: number): string {
	if (!at) return "";
	const date = new Date(at);
	const today = new Date();
	const sameDay =
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate();
	return sameDay
		? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: date.toLocaleDateString([], { month: "short", day: "numeric" }) +
				` ${date.toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				})}`;
}

export function ReviewIcon({ status }: { status: ReviewStatus | null }) {
	if (status === "ok")
		return <CheckmarkCircle16Filled color="var(--green-10)" />;
	if (status === "needs-fix")
		return <Warning16Filled color="var(--amber-10)" />;
	if (status === "unsure") return <Circle16Regular color="var(--orange-10)" />;
	return <Clock16Regular color="var(--gray-8)" />;
}

export function Drawer({
	title,
	subtitle,
	onClose,
	children,
	footer,
}: {
	title: string;
	subtitle?: ReactNode;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<aside className={styles.drawer} aria-label={title}>
			<header className={styles.drawerHeader}>
				<Box style={{ minWidth: 0 }}>
					<Text weight="bold" size="3" as="div">
						{title}
					</Text>
					{subtitle ? (
						<Text size="1" color="gray" as="div" className={styles.ellipsis}>
							{subtitle}
						</Text>
					) : null}
				</Box>
				<Button
					variant="ghost"
					color="gray"
					size="1"
					aria-label="Close panel"
					onClick={onClose}
				>
					✕
				</Button>
			</header>
			<div className={styles.drawerBody}>{children}</div>
			{footer ? <footer className={styles.drawerFooter}>{footer}</footer> : null}
		</aside>
	);
}

export function PaneSection({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className={styles.section}>
			<Flex align="center" justify="between" gap="2">
				<Text size="1" weight="bold" className={styles.sectionTitle}>
					{title}
				</Text>
				{action}
			</Flex>
			{children}
		</section>
	);
}

export function Hint({ children }: { children: ReactNode }) {
	return (
		<Text size="1" color="gray" as="div" className={styles.hint}>
			{children}
		</Text>
	);
}
