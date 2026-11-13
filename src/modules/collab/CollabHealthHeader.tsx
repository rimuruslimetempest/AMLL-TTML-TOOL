import { Badge, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { activeLineLocks, getCollabHealth } from "./logic";
import {
	collabLatencyAtom,
	collabLocksAtom,
	collabPauseIncomingAtom,
	collabQueuedChangesAtom,
	collabSelfIdAtom,
	collabStatusAtom,
} from "./states";

/**
 * Compact connection status shared by the room dialog and chat panel. The
 * latency value is a real round-trip measurement from the existing ping loop;
 * it is never inferred from the socket being open.
 */
export function CollabHealthHeader({ compact = false }: { compact?: boolean }) {
	const status = useAtomValue(collabStatusAtom);
	const latency = useAtomValue(collabLatencyAtom);
	const queued = useAtomValue(collabQueuedChangesAtom);
	const locks = useAtomValue(collabLocksAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const [paused, setPaused] = useAtom(collabPauseIncomingAtom);
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (locks.length === 0) return;
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [locks.length]);

	const health = getCollabHealth(status, latency);
	const activeLocks = useMemo(
		() =>
			activeLineLocks(locks, now).filter((lock) => lock.clientId !== selfId),
		[locks, now, selfId],
	);
	const activePeople = new Set(activeLocks.map((lock) => lock.clientId)).size;

	return (
		<Flex
			align="center"
			gap="2"
			wrap="wrap"
			px={compact ? "2" : "0"}
			pb={compact ? "2" : "0"}
		>
			<Badge color={health.tone} size="1" variant="soft" title={health.detail}>
				<span
					aria-hidden="true"
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: `var(--${health.tone}-9)`,
						display: "inline-block",
						marginRight: 5,
					}}
				/>
				{health.label}
			</Badge>
			<Text size="1" color="gray">
				{health.detail}
			</Text>
			{queued > 0 && (
				<Badge color="amber" size="1" variant="soft">
					{queued} {queued === 1 ? "edit" : "edits"} held
				</Badge>
			)}
			{activePeople > 0 && (
				<Badge color="blue" size="1" variant="soft">
					{activePeople} {activePeople === 1 ? "person" : "people"} editing
				</Badge>
			)}
			<Text as="label" size="1" color="gray">
				<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
					<Switch
						size="1"
						checked={paused}
						onCheckedChange={setPaused}
						aria-label="Pause incoming edits"
					/>
					{paused ? "Resume incoming" : "Pause incoming"}
				</Flex>
			</Text>
		</Flex>
	);
}
