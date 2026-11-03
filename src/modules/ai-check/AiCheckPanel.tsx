import { Dismiss16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { memo, useMemo } from "react";
import { toast } from "react-toastify";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import { applyIssueFix, goToIssue, useRunAiCheck } from "./index";
import {
	aiCheckErrorAtom,
	aiCheckIgnoredIdsAtom,
	aiCheckIssuesAtom,
	aiCheckPanelOpenAtom,
	aiCheckStatusAtom,
	type AiCheckStatus,
} from "./states";
import {
	severityColor,
	severityLabel,
	type AiCheckIssue,
	type AiCheckSeverity,
} from "./types";

const GROUP_ORDER: AiCheckSeverity[] = ["error", "warning", "suggestion"];

const statusText = (status: AiCheckStatus): string => {
	switch (status) {
		case "running-local":
			return "Running local rules\u2026";
		case "running-ai":
			return "Reviewing with AI\u2026";
		case "done":
			return "Check complete";
		case "error":
			return "Check stopped";
		default:
			return "Not run yet";
	}
};

export const AiCheckPanel = memo(() => {
	const [open, setOpen] = useAtom(aiCheckPanelOpenAtom);
	const [issues, setIssues] = useAtom(aiCheckIssuesAtom);
	const status = useAtomValue(aiCheckStatusAtom);
	const error = useAtomValue(aiCheckErrorAtom);
	const [ignored, setIgnored] = useAtom(aiCheckIgnoredIdsAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const store = useStore();
	const { run } = useRunAiCheck();

	const running = status === "running-local" || status === "running-ai";
	const visible = useMemo(
		() => issues.filter((issue) => !ignored.has(issue.id)),
		[issues, ignored],
	);
	const counts = useMemo(() => {
		const result: Record<AiCheckSeverity, number> = {
			error: 0,
			warning: 0,
			suggestion: 0,
		};
		for (const issue of visible) result[issue.severity] += 1;
		return result;
	}, [visible]);

	if (!open) return null;

	const handleApply = (issue: AiCheckIssue) => {
		if (!applyIssueFix(issue, store)) {
			toast.warn("That fix could not be applied.");
			return;
		}
		setIssues((list) => list.filter((item) => item.id !== issue.id));
		toast.success("Fix applied");
	};

	return (
		<Flex
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1200,
			}}
		>
			<Box
				style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.25)" }}
				onClick={() => setOpen(false)}
			/>
			<Card
				size="2"
				style={{
					width: 400,
					maxWidth: "94vw",
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
						<Heading size="4">AI Check</Heading>
						{running && <Spinner size="1" />}
					</Flex>
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setOpen(false)}
						aria-label="Close AI Check"
					>
						<Dismiss16Regular />
					</IconButton>
				</Flex>

				<Text size="1" color="gray">
					{statusText(status)}. Local rules always run; the AI pass is
					optional.
				</Text>

				<Flex gap="2" wrap="wrap">
					<Button size="1" onClick={() => void run()} disabled={running}>
						{running ? "Re-checking\u2026" : "Re-check"}
					</Button>
					<Button
						size="1"
						variant="soft"
						onClick={() => {
							setSettingsTab("ai-check");
							setSettingsOpen(true);
						}}
					>
						AI settings
					</Button>
					<Flex align="center" gap="2" style={{ marginLeft: "auto" }}>
						<Badge color="red" variant="soft" size="1">
							{counts.error}
						</Badge>
						<Badge color="amber" variant="soft" size="1">
							{counts.warning}
						</Badge>
						<Badge color="blue" variant="soft" size="1">
							{counts.suggestion}
						</Badge>
					</Flex>
				</Flex>

				{error && (
					<Card variant="surface" style={{ padding: 10 }}>
						<Text size="1" color="amber">
							{error}
							{visible.length > 0 ? " Local results are still shown below." : ""}
						</Text>
					</Card>
				)}

				<Box style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
					{visible.length === 0 && !running && !error ? (
						<Card variant="surface" style={{ padding: 16, textAlign: "center" }}>
							<Text size="2" color="gray">
								No issues found. Run AI Check again after your next timing
								pass.
							</Text>
						</Card>
					) : null}

					{GROUP_ORDER.map((severity) => {
						const group = visible.filter(
							(issue) => issue.severity === severity,
						);
						if (group.length === 0) return null;
						return (
							<Flex
								key={severity}
								direction="column"
								gap="2"
								mb="4"
							>
								<Flex align="center" gap="2">
									<Text size="2" weight="bold">
										{severityLabel(severity)}s
									</Text>
									<Badge color={severityColor(severity)} variant="soft" size="1">
										{group.length}
									</Badge>
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
													Line {issue.line}
													{issue.syllableIndex !== undefined
														? ` \u00b7 syllable ${issue.syllableIndex + 1}`
														: ""}
												</Text>
											<Text size="1" color="gray">
												{issue.type}
												{issue.source === "ai" ? " \u00b7 AI" : " \u00b7 local"}
											</Text>
											</Flex>
											<Text size="2">{issue.message}</Text>
											{issue.suggestedFix && (
												<Text size="1" color="gray">
													Suggested: {issue.suggestedFix}
												</Text>
											)}
											<Flex gap="2" wrap="wrap" mt="1">
												<Button
													size="1"
													variant="soft"
													onClick={() => goToIssue(issue, store)}
												>
													Go to
												</Button>
												{issue.fix && (
													<Button
														size="1"
														variant="soft"
														color="green"
														onClick={() => handleApply(issue)}
													>
														Apply fix
													</Button>
												)}
												<Button
													size="1"
													variant="ghost"
													color="gray"
													onClick={() =>
														setIgnored((previous) => {
															const next = new Set(previous);
															next.add(issue.id);
															return next;
														})
													}
												>
													Ignore
												</Button>
											</Flex>
										</Flex>
									</Card>
								))}
							</Flex>
						);
					})}
				</Box>

				<Flex align="center" justify="between" gap="2">
					<Text size="1" color="gray">
						{ignored.size} ignored
					</Text>
					{ignored.size > 0 && (
						<Button
							size="1"
							variant="ghost"
							color="gray"
							onClick={() => setIgnored(new Set())}
						>
							Show ignored
						</Button>
					)}
				</Flex>
			</Card>
		</Flex>
	);
});

export default AiCheckPanel;