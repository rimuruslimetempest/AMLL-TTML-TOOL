import { Dialog } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { uid } from "uid";
import { announce } from "$/modules/accessibility/announce";
import { useRunAiCheck } from "$/modules/ai-check";
import { goToIssue } from "$/modules/ai-check";
import { runLocalChecks } from "$/modules/ai-check/local-checks";
import {
	AI_CHECK_ISSUE_TYPES,
	severityLabel,
	type AiCheckIssue,
	type AiCheckIssueType,
	type AiCheckSeverity,
} from "$/modules/ai-check/types";
import { getProjectList, getProjectVersions, type ProjectInfo } from "$/modules/project/autosave/autosave";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	diffDialogAtom,
	reviewCommentsAtom,
	reviewCockpitOpenAtom,
	reviewResolvedAtom,
	type ReviewComment,
} from "$/modules/studio/state";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	toolModeAtom,
	ToolMode,
} from "$/states/main";
import { registerWorkspaceTab } from "$/modules/studio/workspace";
import { saveFile } from "$/utils/fileSystem";
import styles from "./studio.module.css";

interface ReviewEntry {
	key: string;
	projectId: string;
	projectName: string;
	live: boolean;
	issue: AiCheckIssue;
}

const SEVERITIES: AiCheckSeverity[] = ["error", "warning", "suggestion"];

function issueKey(projectId: string, issue: AiCheckIssue): string {
	return `${projectId}:${issue.id}`;
}

function formatDate(timestamp: number): string {
	try {
		return new Date(timestamp).toLocaleString();
	} catch {
		return String(timestamp);
	}
}

export function ReviewCockpit() {
	const [open, setOpen] = useAtom(reviewCockpitOpenAtom);
	const store = useStore();
	const lyric = useAtomValue(lyricLinesAtom);
	const projectId = useAtomValue(projectIdAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const [resolved, setResolved] = useAtom(reviewResolvedAtom);
	const [comments, setComments] = useAtom(reviewCommentsAtom);
	const setDiff = useSetAtom(diffDialogAtom);
	const setConfirm = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { run: runAiCheck } = useRunAiCheck();
	const [scope, setScope] = useState<"project" | "library">("project");
	const [severities, setSeverities] = useState<Set<AiCheckSeverity>>(
		new Set(SEVERITIES),
	);
	const [types, setTypes] = useState<Set<AiCheckIssueType>>(
		new Set(AI_CHECK_ISSUE_TYPES),
	);
	const [query, setQuery] = useState("");
	const [showResolved, setShowResolved] = useState(true);
	const [library, setLibrary] = useState<ReviewEntry[]>([]);
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const [busy, setBusy] = useState(false);
	const [drafts, setDrafts] = useState<Record<string, string>>({});

	const projectName =
		fileName.replace(/\.[^.]+$/, "") || "Current project";

	const currentEntries = useMemo<ReviewEntry[]>(() => {
		const ttml = exportTTMLText(lyric);
		return runLocalChecks(lyric, ttml).map((issue) => ({
			key: issueKey(projectId, issue),
			projectId,
			projectName,
			live: true,
			issue,
		}));
	}, [lyric, projectId, projectName]);

	useEffect(() => {
		if (!open || scope !== "library") return;
		let cancelled = false;
		setBusy(true);
		getProjectList()
			.then(async (list) => {
				if (cancelled) return;
				setProjects(list);
				const entries: ReviewEntry[] = [];
				for (const project of list.slice(0, 80)) {
					if (cancelled) return;
					const state =
						project.id === projectId ? lyric : project.latestState;
					if (!state?.lyricLines?.length) continue;
					try {
						const ttml = exportTTMLText(state);
						for (const issue of runLocalChecks(state, ttml)) {
							entries.push({
								key: issueKey(project.id, issue),
								projectId: project.id,
								projectName: project.name || "Untitled",
								live: project.id === projectId,
								issue,
							});
						}
					} catch {
						// A damaged project must not stop the rest of the library review.
					}
				}
				if (!cancelled) setLibrary(entries);
			})
			.catch(() => {
				if (!cancelled) setLibrary([]);
			})
			.finally(() => {
				if (!cancelled) setBusy(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, scope, projectId, lyric]);

	const allEntries = scope === "project" ? currentEntries : library;
	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		return allEntries.filter((entry) => {
			const isResolved = resolved[entry.key] !== undefined;
			if (!showResolved && isResolved) return false;
			if (!severities.has(entry.issue.severity)) return false;
			if (!types.has(entry.issue.type)) return false;
			if (!term) return true;
			return `${entry.issue.message} ${entry.projectName} ${entry.issue.line}`
				.toLowerCase()
				.includes(term);
		});
	}, [allEntries, query, resolved, severities, showResolved, types]);

	const counts = useMemo(() => {
		const result: Record<AiCheckSeverity, number> = {
			error: 0,
			warning: 0,
			suggestion: 0,
		};
		let resolvedCount = 0;
		for (const entry of allEntries) {
			result[entry.issue.severity] += 1;
			if (resolved[entry.key] !== undefined) resolvedCount += 1;
		}
		return { ...result, resolvedCount };
	}, [allEntries, resolved]);

	const toggleResolved = (entry: ReviewEntry) => {
		setResolved((current) => {
			const next = { ...current };
			if (next[entry.key] !== undefined) delete next[entry.key];
			else next[entry.key] = [new Date().toISOString()];
			return next;
		});
		announce(
			resolved[entry.key] !== undefined
				? `Issue on line ${entry.issue.line} reopened.`
				: `Issue on line ${entry.issue.line} marked resolved.`,
		);
	};

	const addComment = (entry: ReviewEntry) => {
		const body = drafts[entry.key]?.trim();
		if (!body) return;
		const comment: ReviewComment = {
			id: uid(),
			issueId: entry.issue.id,
			author: "Reviewer",
			body,
			createdAt: Date.now(),
		};
		setComments((current) => ({
			...current,
			[entry.key]: [...(current[entry.key] ?? []), comment],
		}));
		setDrafts((current) => ({ ...current, [entry.key]: "" }));
		announce(`Comment added to line ${entry.issue.line}.`);
	};

	const jumpTo = (entry: ReviewEntry) => {
		const run = () => {
			if (entry.live) {
				store.set(toolModeAtom, ToolMode.Edit);
				goToIssue(entry.issue, store);
				setOpen(false);
				announce(`Jumped to line ${entry.issue.line}.`);
				return;
			}
			const project = projects.find((item) => item.id === entry.projectId);
			const state = project?.latestState;
			if (!state) {
				toast.error("That project is no longer available.");
				return;
			}
			const nextFileName =
				project.saveFileName ?? `${project.name || "project"}.ttml`;
			registerWorkspaceTab(store, state, entry.projectId, nextFileName);
			store.set(projectIdAtom, entry.projectId);
			store.set(newLyricLinesAtom, state);
			store.set(saveFileNameAtom, nextFileName);
			store.set(toolModeAtom, ToolMode.Edit);
			setOpen(false);
			window.setTimeout(() => {
				goToIssue(entry.issue, store);
				announce(`Opened ${entry.projectName}, line ${entry.issue.line}.`);
			}, 80);
		};
		if (!entry.live && isDirty) {
			setConfirm({
				open: true,
				title: "Open another project to fix this?",
				description:
					"Your current edits stay in their workspace tab before the other project opens.",
				confirmText: "Open project",
				onConfirm: run,
			});
			return;
		}
		run();
	};

	const exportReport = async () => {
		const reportEntries = filtered;
		const lines: string[] = [];
		lines.push(`# Review report — ${projectName}`);
		lines.push("");
		lines.push(`Generated ${new Date().toLocaleString()}`);
		lines.push("");
		lines.push("## Summary");
		lines.push("");
		lines.push(`- Scope: ${scope === "project" ? "current project" : "saved library"}`);
		lines.push(`- Errors: ${counts.error}`);
		lines.push(`- Warnings: ${counts.warning}`);
		lines.push(`- Suggestions: ${counts.suggestion}`);
		lines.push(`- Resolved: ${counts.resolvedCount}`);
		lines.push(`- In this report: ${reportEntries.length}`);
		lines.push("");
		lines.push("## Issues");
		lines.push("");
		if (reportEntries.length === 0) {
			lines.push("No issues matched the current filters.");
		}
		for (const entry of reportEntries) {
			const isResolved = resolved[entry.key] !== undefined;
			lines.push(
				`### ${severityLabel(entry.issue.severity)} · ${entry.projectName} · line ${entry.issue.line}${
					entry.issue.syllableIndex !== undefined
						? ` · word ${entry.issue.syllableIndex + 1}`
						: ""
				}`,
			);
			lines.push("");
			lines.push(entry.issue.message);
			lines.push("");
			lines.push(
				`- Type: ${entry.issue.type}`,
			);
			lines.push(`- Status: ${isResolved ? "Resolved" : "Open"}`);
			if (entry.issue.suggestedFix)
				lines.push(`- Suggested fix: ${entry.issue.suggestedFix}`);
			const issueComments = comments[entry.key] ?? [];
			if (issueComments.length > 0) {
				lines.push("- Comments:");
				for (const comment of issueComments) {
					lines.push(
						`  - ${comment.author} (${formatDate(comment.createdAt)}): ${comment.body}`,
					);
				}
			}
			lines.push("");
		}
		const saved = await saveFile(lines.join("\n"), {
			suggestedName: `review-${projectName.replace(/[^\w.-]+/g, "-")}.md`,
			types: [
				{
					description: "Markdown report",
					accept: { "text/markdown": [".md"] },
				},
			],
		});
		if (saved) {
			toast.success(`Review report saved as ${saved}.`);
			announce("Review report saved.");
		}
	};

	const compareLatestVersion = async () => {
		try {
			const versions = await getProjectVersions(projectId);
			if (versions.length === 0) {
				toast.info("This project has no autosaved versions to compare yet.");
				return;
			}
			const latest = versions[0];
			setDiff({
				leftTitle: "Current editor",
				leftText: exportTTMLText(lyric),
				rightTitle: `Autosave · ${formatDate(latest.timestamp)}`,
				rightText: exportTTMLText(latest.data),
			});
		} catch {
			toast.error("Could not load the project's versions.");
		}
	};

	if (!open) return null;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.studioDialog}>
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Review & QA cockpit</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							Local checks across the project, with optional AI review, reviewer
							comments, resolved marks, and a Markdown report. Nothing is timed
							automatically.
						</Dialog.Description>
					</div>
					<div className={styles.studioRow}>
						<button
							type="button"
							className={styles.studioSecondary}
							onClick={() => void compareLatestVersion()}
						>
							Diff latest autosave
						</button>
						<button
							type="button"
							className={styles.studioPrimary}
							onClick={() => void exportReport()}
						>
							Export report
						</button>
						<Dialog.Close>
							<button type="button" className={styles.studioSecondary}>
								Close
							</button>
						</Dialog.Close>
					</div>
				</div>

				<div className={styles.reviewLayout}>
					<div className={styles.reviewSidebar}>
						<div className={styles.reviewFilters}>
							<strong style={{ fontSize: 12 }}>Scope</strong>
							<div className={styles.studioRow}>
								<button
									type="button"
									className={styles.studioTab}
									data-active={scope === "project"}
									onClick={() => setScope("project")}
								>
									This project
								</button>
								<button
									type="button"
									className={styles.studioTab}
									data-active={scope === "library"}
									onClick={() => setScope("library")}
								>
									Saved library
								</button>
							</div>
							<strong style={{ fontSize: 12, marginBlockStart: 4 }}>
								Severity
							</strong>
							{SEVERITIES.map((severity) => (
								<label key={severity} className={styles.exportCheck}>
									<input
										type="checkbox"
										checked={severities.has(severity)}
										onChange={(event) =>
											setSeverities((current) => {
												const next = new Set(current);
												if (event.target.checked) next.add(severity);
												else next.delete(severity);
												return next;
											})
										}
									/>
									{severityLabel(severity)} ({counts[severity]})
								</label>
							))}
							<strong style={{ fontSize: 12, marginBlockStart: 4 }}>Type</strong>
							{AI_CHECK_ISSUE_TYPES.map((type) => (
								<label key={type} className={styles.exportCheck}>
									<input
										type="checkbox"
										checked={types.has(type)}
										onChange={(event) =>
											setTypes((current) => {
												const next = new Set(current);
												if (event.target.checked) next.add(type);
												else next.delete(type);
												return next;
											})
										}
									/>
									{type}
								</label>
							))}
							<label className={styles.exportCheck} style={{ marginBlockStart: 4 }}>
								<input
									type="checkbox"
									checked={showResolved}
									onChange={(event) => setShowResolved(event.target.checked)}
								/>
								Show resolved
							</label>
							<input
								className={styles.studioInput}
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Filter messages…"
								aria-label="Filter review issues"
							/>
							<button
								type="button"
								className={styles.studioSecondary}
								onClick={() => void runAiCheck()}
							>
								Run optional AI review
							</button>
						</div>
						<div className={styles.reviewFilters}>
							<div className={styles.reviewStat}>
								<span>Errors</span>
								<strong>{counts.error}</strong>
							</div>
							<div className={styles.reviewStat}>
								<span>Warnings</span>
								<strong>{counts.warning}</strong>
							</div>
							<div className={styles.reviewStat}>
								<span>Suggestions</span>
								<strong>{counts.suggestion}</strong>
							</div>
							<div className={styles.reviewStat}>
								<span>Resolved</span>
								<strong>{counts.resolvedCount}</strong>
							</div>
							<div className={styles.reviewStat}>
								<span>Showing</span>
								<strong>{filtered.length}</strong>
							</div>
							<span className={styles.studioMuted}>
								{scope === "library"
									? busy
										? "Checking saved projects…"
										: `${projects.length} saved project${
												projects.length === 1 ? "" : "s"
											} scanned.`
									: "Checks run locally and instantly as you edit."}
							</span>
						</div>
					</div>

					<div className={styles.reviewList}>
						{filtered.length === 0 ? (
							<div className={styles.reviewEmpty}>
								{busy
									? "Checking the saved library…"
									: allEntries.length === 0
										? "No issues found. A clean project is a good project."
										: "No issues match these filters."}
							</div>
						) : (
							filtered.map((entry) => {
								const isResolved = resolved[entry.key] !== undefined;
								return (
									<div
										key={entry.key}
										className={styles.reviewIssue}
										data-resolved={isResolved}
									>
										<div className={styles.reviewIssueHead}>
											<span
												className={styles.reviewSeverity}
												data-severity={entry.issue.severity}
											>
												{entry.issue.severity}
											</span>
											<span className={styles.studioMuted}>
												{entry.projectName} · line {entry.issue.line}
												{entry.issue.syllableIndex !== undefined
													? ` · word ${entry.issue.syllableIndex + 1}`
													: ""}{" "}
												· {entry.issue.type}
											</span>
											<span style={{ flex: 1 }} />
											{isResolved ? (
												<span className={styles.studioBadge}>Resolved</span>
											) : null}
										</div>
										<div className={styles.reviewMessage}>
											{entry.issue.message}
										</div>
										{entry.issue.suggestedFix ? (
											<div className={styles.studioMuted}>
												Suggested: {entry.issue.suggestedFix}
											</div>
										) : null}
										<div className={styles.studioRow}>
											<button
												type="button"
												className={styles.studioSecondary}
												onClick={() => jumpTo(entry)}
											>
												Go to line
											</button>
											<button
												type="button"
												className={styles.studioSecondary}
												onClick={() => toggleResolved(entry)}
											>
												{isResolved ? "Reopen" : "Mark resolved"}
											</button>
											<span style={{ flex: 1 }} />
											<input
												className={styles.studioInput}
												style={{ maxWidth: 260 }}
												value={drafts[entry.key] ?? ""}
												onChange={(event) =>
													setDrafts((current) => ({
														...current,
														[entry.key]: event.target.value,
													}))
												}
												placeholder="Add a reviewer comment…"
												onKeyDown={(event) => {
													if (event.key === "Enter") addComment(entry);
												}}
												aria-label={`Comment on line ${entry.issue.line}`}
											/>
											<button
												type="button"
												className={styles.studioSecondary}
												onClick={() => addComment(entry)}
											>
												Comment
											</button>
										</div>
										{(comments[entry.key] ?? []).map((comment) => (
											<div key={comment.id} className={styles.reviewComment}>
												<div className={styles.reviewCommentMeta}>
													{comment.author} · {formatDate(comment.createdAt)}
												</div>
												{comment.body}
											</div>
										))}
									</div>
								);
							})
						)}
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
