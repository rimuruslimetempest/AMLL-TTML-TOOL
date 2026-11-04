import { Dismiss16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	IconButton,
	Select,
	Spinner,
	Tabs,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom, metadataEditorDialogAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	projectIdAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	loadSubmissionChecklistState,
	saveSubmissionChecklistState,
} from "./projectState";
import {
	formatSubmissionMessage,
	formatSubmissionSummary,
	runSubmissionChecks,
} from "./runChecks";
import { submissionChecklistOpenAtom } from "./states";
import {
	getSubmissionRoute,
	isRemovableEmptyLine,
	SUBMISSION_MANUAL_SECTIONS,
	SUBMISSION_ROUTES,
} from "./submissionRules";
import {
	SUBMISSION_CATEGORY_LABELS,
	SUBMISSION_CHECKLIST_SCROLL_EVENT,
	SUBMISSION_LEVEL_LABELS,
	type SubmissionChecklistProjectState,
	type SubmissionCheckResult,
	type SubmissionInfo,
	type SubmissionIssue,
	type SubmissionLevel,
	type SubmissionRouteId,
} from "./types";

const LEVEL_GROUPS: SubmissionLevel[] = [
	"forbidden",
	"required",
	"recommended",
	"discouraged",
];

const levelColor = (level: SubmissionLevel): "red" | "amber" | "gray" => {
	if (level === "required" || level === "forbidden") return "red";
	if (level === "recommended") return "amber";
	return "gray";
};

const formatLineList = (lines: number[]): string => {
	const unique = Array.from(new Set(lines)).sort((a, b) => a - b);
	const first = unique[0];
	const last = unique[unique.length - 1];
	if (
		unique.length >= 3 &&
		first !== undefined &&
		last !== undefined &&
		last - first + 1 === unique.length
	) {
		return `${first}–${last}`;
	}
	return unique.join(", ");
};

const issueLocation = (issue: SubmissionIssue): string => {
	if (issue.target === "metadata") return "Metadata";
	if (issue.lines && issue.lines.length > 1) {
		return `Lines ${formatLineList(issue.lines)}`;
	}
	if (issue.line !== undefined) return `Line ${issue.line}`;
	return "Project";
};

export const SubmissionChecklistPanel = () => {
	const [open, setOpen] = useAtom(submissionChecklistOpenAtom);
	const projectId = useAtomValue(projectIdAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const normalization = useAtomValue(lyricTextNormalizationOptionsAtom);
	const allowConsecutiveBackgroundLines = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setMetadataDialog = useSetAtom(metadataEditorDialogAtom);
	const store = useStore();

	const [projectState, setProjectState] =
		useState<SubmissionChecklistProjectState>(() =>
			loadSubmissionChecklistState(projectId),
		);
	const [result, setResult] = useState<SubmissionCheckResult | null>(null);
	const [running, setRunning] = useState(false);
	const runToken = useRef(0);

	useEffect(() => {
		setProjectState(loadSubmissionChecklistState(projectId));
		setResult(null);
	}, [projectId]);

	const runChecks = useCallback(() => {
		const token = ++runToken.current;
		setRunning(true);
		window.requestAnimationFrame(() => {
			const next = runSubmissionChecks(lyric, {
				normalization,
				allowConsecutiveBackgroundLines,
				dismissedIssueIds: projectState.dismissedIssueIds,
			});
			if (token !== runToken.current) return;
			setResult(next);
			setRunning(false);
		});
	}, [
		allowConsecutiveBackgroundLines,
		lyric,
		normalization,
		projectState.dismissedIssueIds,
	]);

	useEffect(() => {
		if (!open) return;
		setRunning(true);
		const timer = window.setTimeout(runChecks, 150);
		return () => window.clearTimeout(timer);
	}, [open, runChecks]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, setOpen]);

	const updateState = useCallback(
		(
			updater: (
				previous: SubmissionChecklistProjectState,
			) => SubmissionChecklistProjectState,
		) => {
			setProjectState((previous) => {
				const next = updater(previous);
				saveSubmissionChecklistState(projectId, next);
				return next;
			});
		},
		[projectId],
	);

	const updateInfo = (key: keyof SubmissionInfo, value: string) => {
		updateState((previous) => ({
			...previous,
			info: { ...previous.info, [key]: value },
		}));
	};

	const handleManualChange = (id: string, checked: boolean) => {
		updateState((previous) => ({
			...previous,
			manualChecks: { ...previous.manualChecks, [id]: checked },
		}));
	};

	const handleDismiss = (issue: SubmissionIssue) => {
		updateState((previous) => ({
			...previous,
			dismissedIssueIds: Array.from(
				new Set([...previous.dismissedIssueIds, issue.id]),
			),
		}));
	};

	const handleGoTo = (issue: SubmissionIssue) => {
		if (issue.target === "metadata") {
			setOpen(false);
			setMetadataDialog(true);
			return;
		}
		if (issue.lineIndex === undefined) return;
		const line = store.get(lyricLinesAtom).lyricLines[issue.lineIndex];
		if (!line) return;
		store.set(selectedLinesAtom, new Set([line.id]));
		const word =
			issue.wordIndex !== undefined ? line.words[issue.wordIndex] : undefined;
		store.set(selectedWordsAtom, word ? new Set([word.id]) : new Set());
		window.dispatchEvent(
			new CustomEvent<number>(SUBMISSION_CHECKLIST_SCROLL_EVENT, {
				detail: issue.lineIndex,
			}),
		);
	};

	const handleFix = (issue: SubmissionIssue) => {
		if (issue.fix !== "remove-empty-lines") return;
		const emptyCount = store
			.get(lyricLinesAtom)
			.lyricLines.filter(isRemovableEmptyLine).length;
		if (emptyCount === 0) return;
		setConfirmDialog({
			open: true,
			title: "Remove empty lyric lines?",
			description: `This will remove ${emptyCount} empty lyric line${
				emptyCount === 1 ? "" : "s"
			}. It will not change any lyric text or timing.`,
			confirmText: "Remove empty lines",
			onConfirm: () => {
				const current = store.get(lyricLinesAtom);
				const removedIds = new Set(
					current.lyricLines
						.filter(isRemovableEmptyLine)
						.map((line) => line.id),
				);
				if (removedIds.size === 0) return;
				store.set(lyricLinesAtom, {
					...current,
					lyricLines: current.lyricLines.filter(
						(line) => !removedIds.has(line.id),
					),
				});
				const selected = store.get(selectedLinesAtom);
				store.set(
					selectedLinesAtom,
					new Set(Array.from(selected).filter((id) => !removedIds.has(id))),
				);
				store.set(selectedWordsAtom, new Set());
				toast.success(
					`Removed ${removedIds.size} empty lyric line${
						removedIds.size === 1 ? "" : "s"
					}`,
				);
			},
		});
	};

	const handleCopy = async () => {
		if (!result) {
			toast.warn("Re-check the checklist before copying a submission message.");
			return;
		}
		try {
			await navigator.clipboard.writeText(
				formatSubmissionMessage(result, projectState.info),
			);
			toast.success("Submission message copied");
		} catch {
			toast.error("Could not copy the submission message.");
		}
	};

	if (!open) return null;

	const counts: Record<SubmissionLevel, number> = {
		required: 0,
		recommended: 0,
		discouraged: 0,
		forbidden: 0,
	};
	for (const issue of result?.issues ?? []) counts[issue.level] += 1;

	const ready = Boolean(result && result.blockedCount === 0);
	const summary = result
		? formatSubmissionSummary(result)
		: running
			? "Checking the current project…"
			: "Run the checklist to review this project.";
	const manualTotal = SUBMISSION_MANUAL_SECTIONS.reduce(
		(total, section) => total + section.items.length,
		0,
	);
	const manualChecked = SUBMISSION_MANUAL_SECTIONS.reduce(
		(total, section) =>
			total +
			section.items.filter((item) => projectState.manualChecks[item.id]).length,
		0,
	);
	const route = getSubmissionRoute(projectState.route);

	return (
		<Flex
			data-testid="submission-checklist-panel"
			style={{ position: "fixed", inset: 0, zIndex: 1200 }}
		>
			<Box
				style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.25)" }}
				onClick={() => setOpen(false)}
			/>
			<Card
				size="2"
				style={{
					width: 560,
					maxWidth: "96vw",
					height: "100%",
					borderRadius: 0,
					display: "flex",
					flexDirection: "column",
					gap: 10,
					padding: 16,
					backgroundColor: "var(--color-panel-solid)",
					borderLeft: "1px solid var(--gray-a4)",
					boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.25)",
				}}
			>
				<Flex align="center" justify="between" gap="2">
					<Flex align="center" gap="2">
						<Heading size="4">Submission Checklist</Heading>
						{running && <Spinner size="1" />}
					</Flex>
					<Flex align="center" gap="2">
						<Button
							size="1"
							onClick={runChecks}
							disabled={running}
							aria-label="Re-check submission checklist"
						>
							{running ? "Checking…" : "Re-check"}
						</Button>
						<IconButton
							size="1"
							variant="ghost"
							color="gray"
							onClick={() => setOpen(false)}
							aria-label="Close Submission Checklist"
						>
							<Dismiss16Regular />
						</IconButton>
					</Flex>
				</Flex>

				<Card
					variant="surface"
					style={{
						padding: 12,
						backgroundColor: ready ? "var(--green-a2)" : "var(--amber-a2)",
					}}
				>
					<Flex align="start" justify="between" gap="2">
						<Box>
							<Text size="3" weight="bold">
								{result
									? ready
										? "Ready to submit"
										: "Not ready yet"
									: "Submission checks"}
							</Text>
							<Text size="1" color="gray" style={{ display: "block" }}>
								{summary}
							</Text>
						</Box>
						<Badge color={ready ? "green" : "red"} variant="soft">
							{ready ? "Ready" : "Blocked"}
						</Badge>
					</Flex>
					<Flex gap="2" wrap="wrap" mt="2">
						<Badge color="red" variant="soft">
							Required {counts.required}
						</Badge>
						<Badge color="red" variant="soft">
							Forbidden {counts.forbidden}
						</Badge>
						<Badge color="amber" variant="soft">
							Warnings {counts.recommended + counts.discouraged}
						</Badge>
					</Flex>
				</Card>

				<Text size="1" color="gray">
					These checks run locally and never change lyrics or timing. Only empty
					lines have an optional one-click fix.
				</Text>

				<Tabs.Root
					defaultValue="automatic"
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						minHeight: 0,
					}}
				>
					<Tabs.List>
						<Tabs.Trigger value="automatic">Automatic</Tabs.Trigger>
						<Tabs.Trigger value="manual">
							Manual ({manualChecked}/{manualTotal})
						</Tabs.Trigger>
						<Tabs.Trigger value="submission">Submission info</Tabs.Trigger>
					</Tabs.List>

					<Box
						style={{
							flex: 1,
							overflowY: "auto",
							paddingTop: 10,
							paddingRight: 4,
						}}
					>
						<Tabs.Content value="automatic">
							{!result && running && (
								<Flex align="center" gap="2">
									<Spinner size="1" />
									<Text size="2" color="gray">
										Checking the current project…
									</Text>
								</Flex>
							)}
							{!result && !running && (
								<Text size="2" color="gray">
									Press Re-check to run the submission rules.
								</Text>
							)}
							{result && (
								<>
									{result.projectLanguage === null && (
										<Text
											size="1"
											color="gray"
											style={{ display: "block", marginBottom: 10 }}
										>
											Language-specific checks are skipped because no project
											language is set. No language was guessed.
										</Text>
									)}
									{result.issues.length === 0 && (
										<Card
											variant="surface"
											style={{ padding: 14, marginBottom: 12 }}
										>
											<Text size="2" color="green">
												No automatic issues found.
											</Text>
										</Card>
									)}
									{LEVEL_GROUPS.map((level) => {
										const group = result.issues.filter(
											(issue) => issue.level === level,
										);
										if (group.length === 0) return null;
										return (
											<Flex key={level} direction="column" gap="2" mb="4">
												<Flex align="center" gap="2">
													<Badge color={levelColor(level)} variant="soft">
														{group.length}
													</Badge>
													<Text size="2" weight="bold">
														{SUBMISSION_LEVEL_LABELS[level]}
													</Text>
												</Flex>
												{group.map((issue) => (
													<Card
														key={issue.id}
														variant="surface"
														style={{ padding: 10 }}
													>
														<Flex direction="column" gap="1">
															<Flex align="center" justify="between" gap="2">
																<Text size="1" color="gray">
																	{issueLocation(issue)} ·{" "}
																	{SUBMISSION_CATEGORY_LABELS[issue.category]}
																</Text>
																<Badge
																	color={levelColor(issue.level)}
																	variant="soft"
																	size="1"
																>
																	{SUBMISSION_LEVEL_LABELS[issue.level]}
																</Badge>
															</Flex>
															<Text size="2" weight="medium">
																{issue.ruleMessage}
															</Text>
															<Text size="1">{issue.detail}</Text>
															<Text size="1" color="gray">
																{issue.ruleHint}
															</Text>
															<Flex gap="2" wrap="wrap" mt="1">
																{issue.target === "metadata" ? (
																	<Button
																		size="1"
																		variant="soft"
																		onClick={() => handleGoTo(issue)}
																	>
																		Go to metadata
																	</Button>
																) : issue.lineIndex !== undefined ? (
																	<Button
																		size="1"
																		variant="soft"
																		onClick={() => handleGoTo(issue)}
																	>
																		{issue.lines && issue.lines.length > 1
																			? "Go to first"
																			: "Go to"}
																	</Button>
																) : null}
																{issue.fix === "remove-empty-lines" && (
																	<Button
																		size="1"
																		variant="soft"
																		color="green"
																		onClick={() => handleFix(issue)}
																	>
																		Remove empty line…
																	</Button>
																)}
																{issue.dismissible && (
																	<Button
																		size="1"
																		variant="ghost"
																		color="gray"
																		onClick={() => handleDismiss(issue)}
																	>
																		{issue.actionLabel ?? "Dismiss"}
																	</Button>
																)}
															</Flex>
														</Flex>
													</Card>
												))}
											</Flex>
										);
									})}
									{result.passedRules.length > 0 && (
										<details style={{ marginTop: 8 }}>
											<summary style={{ cursor: "pointer" }}>
												<Text size="1" color="gray">
													{result.passedRules.length} checks passed
												</Text>
											</summary>
											<Flex direction="column" gap="1" mt="2">
												{result.passedRules.map((rule) => (
													<Text key={rule.id} size="1" color="gray">
														✓ {rule.message}
													</Text>
												))}
											</Flex>
										</details>
									)}
									{result.dismissedCount > 0 && (
										<Text
											size="1"
											color="gray"
											style={{ display: "block", marginTop: 10 }}
										>
											{result.dismissedCount} issue
											{result.dismissedCount === 1 ? "" : "s"} dismissed for
											this project.
										</Text>
									)}
								</>
							)}
						</Tabs.Content>

						<Tabs.Content value="manual">
							<Text
								size="1"
								color="gray"
								style={{ display: "block", marginBottom: 10 }}
							>
								Saved for this project. Tick each item only after you have
								actually checked it.
							</Text>
							<Flex direction="column" gap="3">
								{SUBMISSION_MANUAL_SECTIONS.map((section) => (
									<Card
										key={section.id}
										variant="surface"
										style={{ padding: 12 }}
									>
										<Heading size="3" mb="2">
											{section.title}
										</Heading>
										<Flex direction="column" gap="3">
											{section.items.map((item) => (
												<Text
													key={item.id}
													as="label"
													size="1"
													style={{
														display: "flex",
														gap: 8,
														alignItems: "flex-start",
														cursor: "pointer",
													}}
												>
													<Checkbox
														checked={Boolean(
															projectState.manualChecks[item.id],
														)}
														onCheckedChange={(checked) =>
															handleManualChange(item.id, checked === true)
														}
														style={{ marginTop: 2, flexShrink: 0 }}
													/>
													<span>{item.label}</span>
												</Text>
											))}
										</Flex>
									</Card>
								))}
							</Flex>
						</Tabs.Content>

						<Tabs.Content value="submission">
							<Flex direction="column" gap="3">
								<Box>
									<Text size="2" weight="bold" as="label">
										Exact song link(s)
									</Text>
									<TextArea
										rows={3}
										mt="1"
										value={projectState.info.songLinks}
										onChange={(event) =>
											updateInfo("songLinks", event.currentTarget.value)
										}
										placeholder="https://open.spotify.com/track/…"
									/>
								</Box>
								<Box>
									<Text size="2" weight="bold" as="label">
										Version notes
									</Text>
									<TextArea
										rows={2}
										mt="1"
										value={projectState.info.versionNotes}
										onChange={(event) =>
											updateInfo("versionNotes", event.currentTarget.value)
										}
										placeholder="Clean, explicit, radio edit, remaster, etc."
									/>
								</Box>
								<Box>
									<Text size="2" weight="bold" as="label">
										Spotify target ID(s)
									</Text>
									<TextField.Root
										mt="1"
										value={projectState.info.spotifyIds}
										onChange={(event) =>
											updateInfo("spotifyIds", event.currentTarget.value)
										}
										placeholder="Spotify track ID(s), separated by commas or new lines"
									/>
								</Box>

								<Box>
									<Text size="2" weight="bold" as="label">
										Which route applies to me?
									</Text>
									<Select.Root
										value={projectState.route}
										onValueChange={(value) =>
											updateState((previous) => ({
												...previous,
												route: value as SubmissionRouteId,
											}))
										}
									>
										<Select.Trigger
											mt="1"
											placeholder="Choose your route"
											style={{ width: "100%" }}
										/>
										<Select.Content>
											{SUBMISSION_ROUTES.map((option) => (
												<Select.Item key={option.id} value={option.id}>
													{option.label}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								</Box>

								<Card variant="surface" style={{ padding: 12 }}>
									<Heading size="3" mb="2">
										{route.label}: steps
									</Heading>
									<ol style={{ margin: 0, paddingLeft: 20 }}>
										{route.steps.map((step) => (
											<li key={step} style={{ marginBottom: 6 }}>
												<Text size="1">{step}</Text>
											</li>
										))}
									</ol>
								</Card>

								<Button onClick={() => void handleCopy()} disabled={!result}>
									Copy submission message
								</Button>
								<Text size="1" color="gray">
									The copy button only puts the song link, version notes, and
									checklist summary on your clipboard. It does not submit
									anything.
								</Text>
							</Flex>
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Card>
		</Flex>
	);
};

export default SubmissionChecklistPanel;
