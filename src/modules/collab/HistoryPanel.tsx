import {
	Add16Regular,
	ArrowCounterclockwise16Regular,
	Clock16Regular,
	History16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Flex,
	Select,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { lyricLinesAtom } from "$/states/main";
import { collabClient } from "./client";
import type { CollabHistoryEntry } from "./model";
import { can } from "./permissions";
import {
	collabHistoryAtom,
	collabPolicyAtom,
	collabRestorePointsAtom,
	collabRoleAtom,
} from "./states";
import { Drawer, Hint, PaneSection, formatWhen } from "./ui";
import styles from "./collab-ui.module.css";

const KIND_LABEL: Record<string, string> = {
	lyrics: "Lyrics",
	timing: "Timing",
	insert: "Added lines",
	delete: "Deleted lines",
	order: "Reorder",
	metadata: "Metadata",
	role: "People",
	audio: "Audio",
	comment: "Comments",
	review: "Review",
	rollback: "Rollback",
	"restore-point": "Restore point",
	invite: "Invite",
	policy: "Settings",
};

interface BundleLine {
	lineId: string;
	text: string;
	words: { word: string; startTime: number; endTime: number }[];
}

function bundleLines(before: unknown): BundleLine[] {
	if (!before || typeof before !== "object") return [];
	const value = before as { lines?: unknown };
	const raw = Array.isArray(value.lines)
		? value.lines
		: Array.isArray(before)
			? before
			: [];
	return raw
		.map((entry) => {
			const record = entry as {
				id?: string;
				words?: { word?: string; startTime?: number; endTime?: number }[];
				data?: {
					words?: { word?: string; startTime?: number; endTime?: number }[];
				};
			};
			const words = record.data?.words ?? record.words ?? [];
			return {
				lineId: record.id ?? "",
				text: words.map((word) => word.word ?? "").join(""),
				words: words.map((word) => ({
					word: word.word ?? "",
					startTime: word.startTime ?? 0,
					endTime: word.endTime ?? 0,
				})),
			};
		})
		.filter((line) => line.lineId);
}

function hasConflict(
	entry: CollabHistoryEntry,
	lines: { id: string; words: { word: string; startTime: number; endTime: number }[] }[],
): boolean {
	if (!entry.before || !entry.after) return false;
	const current = new Map(lines.map((line) => [line.id, line]));
	return bundleLines(entry.after).some((expected) => {
		const line = current.get(expected.lineId);
		if (!line) return true;
		return (
			line.words
				.map((word) => `${word.word}\u0001${word.startTime}\u0001${word.endTime}`)
				.join("\u0002") !==
			expected.words
				.map((word) => `${word.word}\u0001${word.startTime}\u0001${word.endTime}`)
				.join("\u0002")
		);
	});
}

function authorOptions(entries: CollabHistoryEntry[]) {
	const authors = new Map<string, string>();
	for (const entry of entries) authors.set(entry.authorId, entry.authorName);
	return [...authors.entries()];
}

export function HistoryPanel({ onClose }: { onClose: () => void }) {
	const history = useAtomValue(collabHistoryAtom);
	const restorePoints = useAtomValue(collabRestorePointsAtom);
	const role = useAtomValue(collabRoleAtom);
	const policy = useAtomValue(collabPolicyAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const [kind, setKind] = useState("all");
	const [author, setAuthor] = useState("all");
	const [query, setQuery] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [pointName, setPointName] = useState("");

	const canRollback = can(role, "rollback", policy);
	const authors = useMemo(() => authorOptions(history), [history]);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return history
			.slice()
			.reverse()
			.filter((entry) => {
				if (kind !== "all" && entry.kind !== kind) return false;
				if (author !== "all" && entry.authorId !== author) return false;
				if (!needle) return true;
				return (
					entry.summary.toLowerCase().includes(needle) ||
					entry.authorName.toLowerCase().includes(needle) ||
					bundleLines(entry.before).some((line) =>
						line.text.toLowerCase().includes(needle),
					) ||
					bundleLines(entry.after).some((line) =>
						line.text.toLowerCase().includes(needle),
					)
				);
			});
	}, [history, kind, author, query]);

	const selected =
		filtered.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null;
	const beforeLines = selected ? bundleLines(selected.before) : [];
	const afterLines = selected ? bundleLines(selected.after) : [];
	const changedLineIds = new Set([
		...beforeLines.map((line) => line.lineId),
		...afterLines.map((line) => line.lineId),
	]);

	const revert = (entry: CollabHistoryEntry) => {
		if (!canRollback) {
			collabClient.notify("rollback");
			return;
		}
		const conflict = hasConflict(entry, lyrics.lyricLines);
		if (
			!window.confirm(
				conflict
					? "Someone changed these lines after this entry. Reverting restores the version from before this single change and will overwrite their newer edit on the affected lines. Continue?"
					: `Revert "${entry.summary}"?`,
			)
		) {
			return;
		}
		if (collabClient.revertHistory(entry.id)) {
			toast.success("Revert sent to the room");
		}
	};

	return (
		<Drawer
			title="Room history"
			subtitle={`${history.length} changes · ${restorePoints.length} restore points`}
			onClose={onClose}
			footer={
				<Button variant="soft" color="gray" onClick={onClose}>
					Done
				</Button>
			}
		>
			<PaneSection title="Filter">
				<Flex gap="2" wrap="wrap">
					<Select.Root value={kind} onValueChange={setKind}>
						<Select.Trigger aria-label="Change type" />
						<Select.Content>
							<Select.Item value="all">All changes</Select.Item>
							{Object.entries(KIND_LABEL).map(([value, label]) => (
								<Select.Item key={value} value={value}>
									{label}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Select.Root value={author} onValueChange={setAuthor}>
						<Select.Trigger aria-label="Person" />
						<Select.Content>
							<Select.Item value="all">Everyone</Select.Item>
							{authors.map(([id, name]) => (
								<Select.Item key={id} value={id}>
									{name}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<TextField.Root
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search text or person"
					/>
				</Flex>
			</PaneSection>

			{!canRollback ? (
				<Hint>
					You can browse history. Only the host
					{policy.editorsCanRollback ? " and editors" : ""} can revert or
					restore.
				</Hint>
			) : null}

			<PaneSection title={`Changes (${filtered.length})`}>
				{filtered.length === 0 ? <Hint>No changes match this filter.</Hint> : null}
				<div className={styles.list}>
					{filtered.slice(0, 300).map((entry) => {
						const active = selected?.id === entry.id;
						return (
							<button
								key={entry.id}
								type="button"
								className={`${styles.row} ${styles.rowButton} ${active ? styles.selected : ""}`}
								onClick={() => setSelectedId(entry.id)}
							>
								<Clock16Regular color="var(--gray-9)" />
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Flex gap="1" align="center" wrap="wrap">
										<Text size="2" weight={active ? "bold" : "medium"}>
											{entry.summary}
										</Text>
										<Badge size="1" variant="soft">
											{KIND_LABEL[entry.kind] ?? entry.kind}
										</Badge>
									</Flex>
									<Text size="1" color="gray">
										{entry.authorName} · {formatWhen(entry.at)}
									</Text>
								</Box>
							</button>
						);
					})}
				</div>
			</PaneSection>

			{selected ? (
				<PaneSection title="Selected change">
					<Flex align="center" justify="between" gap="2" wrap="wrap">
						<Text size="2" weight="bold">
							{selected.summary}
						</Text>
						<Button
							size="1"
							variant="soft"
							color="gray"
							onClick={() => revert(selected)}
							disabled={!canRollback}
						>
							<ArrowCounterclockwise16Regular /> Revert this change
						</Button>
					</Flex>
					<Text size="1" color="gray">
						{selected.authorName} · {formatWhen(selected.at)} ·{" "}
						{selected.lineIds.length} line
						{selected.lineIds.length === 1 ? "" : "s"}
						{selected.revertOf ? " · this was a rollback" : ""}
					</Text>
					{hasConflict(selected, lyrics.lyricLines) ? (
						<Badge size="1" color="amber">
							These lines changed after this entry
						</Badge>
					) : null}
					{beforeLines.length || afterLines.length ? (
						<div className={styles.diff}>
							{[...changedLineIds].slice(0, 30).map((lineId) => {
								const before = beforeLines.find((line) => line.lineId === lineId);
								const after = afterLines.find((line) => line.lineId === lineId);
								if (before?.text === after?.text) return null;
								return (
									<Box key={lineId}>
										{before ? (
											<div className={`${styles.diffBlock} ${styles.diffBefore}`}>
												<Text size="1" color="red" as="div">
													Before
												</Text>
												{before.text || "(empty)"}
											</div>
										) : null}
										{after ? (
											<div className={`${styles.diffBlock} ${styles.diffAfter}`}>
												<Text size="1" color="green" as="div">
													After
												</Text>
												{after.text || "(empty)"}
											</div>
										) : null}
									</Box>
								);
							})}
						</div>
					) : (
						<Hint>This entry doesn't include lyric text (people or settings).</Hint>
					)}
				</PaneSection>
			) : null}

			<PaneSection title="Restore points">
				<Flex gap="2">
					<TextField.Root
						value={pointName}
						onChange={(event) => setPointName(event.currentTarget.value)}
						placeholder="Name this point, e.g. Before verse edits"
						style={{ flex: 1 }}
					/>
					<Button
						disabled={!canRollback}
						onClick={() => {
							if (collabClient.createRestorePoint(pointName)) {
								setPointName("");
								toast.success("Restore point created");
							}
						}}
					>
						<Add16Regular /> Save
					</Button>
				</Flex>
				{restorePoints.length === 0 ? (
					<Hint>
						Restore points keep the whole project at one moment. Restoring
						creates a new history entry so nothing disappears silently.
					</Hint>
				) : null}
				<div className={styles.list}>
					{[...restorePoints].reverse().map((point) => (
						<div key={point.id} className={styles.row}>
							<History16Regular />
							<Box style={{ flex: 1, minWidth: 0 }}>
								<Flex gap="1" align="center" wrap="wrap">
									<Text size="2" weight="medium">
										{point.name}
									</Text>
									{point.automatic ? (
										<Badge size="1" color="gray">
											Auto
										</Badge>
									) : null}
								</Flex>
								<Text size="1" color="gray">
									{point.authorName} · {formatWhen(point.at)} ·{" "}
									{point.lineCount} lines
								</Text>
							</Box>
							<Tooltip content="Restore the whole project to this point">
								<Button
									size="1"
									variant="soft"
									color="amber"
									disabled={!canRollback}
									onClick={() => {
										if (
											window.confirm(
												`Restore "${point.name}"? The current project is saved as a "Before rollback" point first.`,
											)
										) {
											collabClient.restoreRestorePoint(point.id);
										}
									}}
								>
									Restore
								</Button>
							</Tooltip>
						</div>
					))}
				</div>
			</PaneSection>
		</Drawer>
	);
}
