import {
	ArrowCounterclockwise24Regular,
	Delete24Regular,
	Search24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Select,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
	getProjectList,
	type ProjectInfo,
} from "$/modules/project/autosave/autosave";
import { projectIdAtom, saveFileNameAtom } from "$/states/main";
import {
	deleteRecycleItem,
	emptyRecycleBin,
	restoreRecycleItem,
	updateRecycleSettings,
} from "./actions";
import {
	binByteSize,
	daysLeft,
	filterItems,
	formatDeletedAt,
	kindLabel,
} from "./logic";
import { loadRecycleBin } from "./storage";
import {
	DEFAULT_RECYCLE_SETTINGS,
	type RecycleBinFile,
	type RecycleItem,
	type RecycleKind,
	type RetentionDays,
} from "./types";
import { recycleBinDialogAtom } from "./state";

const KINDS: Array<RecycleKind | "all"> = [
	"all",
	"line",
	"word",
	"project",
	"split",
	"theme",
];

function kindColor(kind: RecycleKind) {
	switch (kind) {
		case "line":
			return "indigo" as const;
		case "word":
			return "cyan" as const;
		case "project":
			return "green" as const;
		case "split":
			return "amber" as const;
		case "theme":
			return "violet" as const;
	}
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function RecycleBinDialog() {
	const [open, setOpen] = useAtom(recycleBinDialogAtom);
	const currentProjectId = useAtomValue(projectIdAtom);
	const currentProjectName = useAtomValue(saveFileNameAtom);
	const [bin, setBin] = useState<RecycleBinFile | null>(null);
	const [kind, setKind] = useState<RecycleKind | "all">("all");
	const [query, setQuery] = useState("");
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const [target, setTarget] = useState<string>(currentProjectId);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const [next, list] = await Promise.all([
			loadRecycleBin(),
			getProjectList().catch(() => [] as ProjectInfo[]),
		]);
		setBin(next);
		setProjects(list);
	}, []);

	useEffect(() => {
		if (!open) return;
		setTarget(currentProjectId);
		void load();
	}, [open, currentProjectId, load]);

	const settings = bin?.settings ?? DEFAULT_RECYCLE_SETTINGS;
	const visible = useMemo(
		() => filterItems(bin?.items ?? [], { kind, query }),
		[bin, kind, query],
	);
	const groups = useMemo(() => {
		const order: RecycleKind[] = ["line", "word", "project", "split", "theme"];
		return order
			.map((entry) => ({
				kind: entry,
				items: visible.filter((item) => item.kind === entry),
			}))
			.filter((group) => group.items.length > 0);
	}, [visible]);

	const projectOptions = useMemo(() => {
		const seen = new Set<string>();
		const options = [
			{ id: currentProjectId, name: currentProjectName || "This project" },
			...projects.map((project) => ({
				id: project.id,
				name: project.name || "Untitled project",
			})),
		];
		return options.filter((option) => {
			if (seen.has(option.id)) return false;
			seen.add(option.id);
			return true;
		});
	}, [currentProjectId, currentProjectName, projects]);

	const restore = useCallback(
		async (item: RecycleItem) => {
			setBusy(true);
			try {
				const useTarget =
					item.kind === "line" || item.kind === "word" ? target : undefined;
				const result = await restoreRecycleItem(item, useTarget);
				if (!result.ok) {
					toast.error(result.message);
					return;
				}
				toast.success(result.message);
				await deleteRecycleItem(item.id);
				await load();
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Could not restore that item.",
				);
			} finally {
				setBusy(false);
			}
		},
		[load, target],
	);

	const remove = useCallback(
		async (item: RecycleItem) => {
			if (
				!window.confirm(
					"Delete this item permanently? This cannot be undone.",
				)
			) {
				return;
			}
			await deleteRecycleItem(item.id);
			await load();
		},
		[load],
	);

	const empty = useCallback(async () => {
		if (
			!window.confirm(
				"Empty the recycle bin? Every item will be deleted permanently. This cannot be undone.",
			)
		) {
			return;
		}
		await emptyRecycleBin();
		await load();
		toast.success("Recycle bin emptied.");
	}, [load]);

	const changeRetention = useCallback(
		async (value: string) => {
			const retentionDays: RetentionDays =
				value === "never" ? "never" : (Number(value) as 7 | 30 | 90);
			await updateRecycleSettings({ retentionDays });
			await load();
		},
		[load],
	);

	const size = bin ? binByteSize(bin) : 0;
	const nearCap = size > settings.maxBytes * 0.8;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="860px" style={{ width: "min(94vw, 860px)" }}>
				<Dialog.Title>Recycle bin</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					Deleted lines, words, projects, saved splits, and themes stay here
					until their retention period ends. Restoring a line uses the
					neighbors it had when it was deleted.
				</Dialog.Description>

				<Flex gap="2" wrap="wrap" align="center" mb="3">
					<Box style={{ flex: "1 1 220px" }}>
						<TextField.Root
							placeholder="Search by name or project"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						>
							<TextField.Slot>
								<Search24Regular />
							</TextField.Slot>
						</TextField.Root>
					</Box>
					<Select.Root value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
						<Select.Trigger aria-label="Filter by type" />
						<Select.Content>
							{KINDS.map((entry) => (
								<Select.Item key={entry} value={entry}>
									{entry === "all" ? "All types" : kindLabel(entry)}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Select.Root value={target} onValueChange={setTarget}>
						<Select.Trigger aria-label="Restore into project" />
						<Select.Content>
							{projectOptions.map((option) => (
								<Select.Item key={option.id} value={option.id}>
									{option.id === currentProjectId
										? `${option.name} (open now)`
										: option.name}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				</Flex>

				{!bin ? (
					<Text size="2" color="gray">
						Loading the recycle bin…
					</Text>
				) : visible.length === 0 ? (
					<Callout.Root color="gray">
						<Callout.Text>
							{bin.items.length === 0
								? "The recycle bin is empty. Deleted items will appear here."
								: "No items match that search and filter."}
						</Callout.Text>
					</Callout.Root>
				) : (
					<ScrollArea style={{ maxHeight: "46vh" }}>
						<Flex direction="column" gap="4" pr="2">
							{groups.map((group) => (
								<Box key={group.kind}>
									<Flex align="center" gap="2" mb="2">
										<Text weight="bold" size="2">
											{kindLabel(group.kind)}
										</Text>
										<Badge size="1" variant="soft" color="gray">
											{group.items.length}
										</Badge>
									</Flex>
									<Flex direction="column" gap="2">
										{group.items.map((item) => {
											const left = daysLeft(item, settings.retentionDays);
											return (
												<Card key={item.id} variant="surface">
													<Flex align="center" gap="2" wrap="wrap">
														<Badge
															size="1"
															variant="soft"
															color={kindColor(item.kind)}
														>
															{kindLabel(item.kind).slice(0, -1)}
														</Badge>
														<Text size="2" weight="medium" style={{ flex: "1 1 220px" }}>
															{item.name}
														</Text>
														<Button
															size="1"
															variant="soft"
															onClick={() => void restore(item)}
															disabled={busy}
														>
															<ArrowCounterclockwise24Regular />
															Restore
														</Button>
														<IconButton
															size="1"
															variant="soft"
															color="red"
															title="Delete permanently"
															onClick={() => void remove(item)}
															disabled={busy}
														>
															<Delete24Regular />
														</IconButton>
													</Flex>
													<Flex gap="2" wrap="wrap" mt="1">
														{item.projectName && (
															<Text size="1" color="gray">
																Project: {item.projectName}
															</Text>
														)}
														<Text size="1" color="gray">
															Deleted {formatDeletedAt(item.deletedAt)}
														</Text>
														<Text size="1" color="gray">
															{left === null
																? "Kept until you delete it"
																: `${left} day${left === 1 ? "" : "s"} left`}
														</Text>
													</Flex>
												</Card>
											);
										})}
									</Flex>
								</Box>
							))}
						</Flex>
					</ScrollArea>
				)}

				{nearCap && (
					<Callout.Root color="amber" mt="3">
						<Callout.Text>
							The bin is using {formatBytes(size)} of its{" "}
							{formatBytes(settings.maxBytes)} limit. Older items are removed
							first when it reaches the cap.
						</Callout.Text>
					</Callout.Root>
				)}

				<Flex
					justify="between"
					align="center"
					gap="3"
					wrap="wrap"
					mt="4"
					pt="3"
					style={{ borderTop: "1px solid var(--gray-5)" }}
				>
					<Flex gap="2" align="center" wrap="wrap">
						<Text size="1" color="gray">
							Keep deleted items for
						</Text>
						<Select.Root
							value={String(settings.retentionDays)}
							onValueChange={(value) => void changeRetention(value)}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value="7">7 days</Select.Item>
								<Select.Item value="30">30 days</Select.Item>
								<Select.Item value="90">90 days</Select.Item>
								<Select.Item value="never">Until I delete them</Select.Item>
							</Select.Content>
						</Select.Root>
						<Text size="1" color="gray">
							{formatBytes(size)} used
						</Text>
					</Flex>
					<Flex gap="2" wrap="wrap">
						<Button
							size="1"
							variant="soft"
							color="red"
							onClick={() => void empty()}
							disabled={!bin || bin.items.length === 0}
						>
							Empty bin
						</Button>
						<Dialog.Close>
							<Button size="1">Close</Button>
						</Dialog.Close>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
