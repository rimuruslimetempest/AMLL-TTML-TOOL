import { Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
	getProjectList,
	getProjectVersions,
	type ProjectInfo,
	type ProjectVersion,
} from "$/modules/project/autosave/autosave";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	crashRecoveryAtom,
	diffDialogAtom,
	pluginStudioOpenAtom,
	reviewCockpitOpenAtom,
	savedWorkspacesAtom,
	themeStudioOpenAtom,
	workspaceHomeOpenAtom,
	workspaceManagerOpenAtom,
	type SessionSnapshot,
	commandPaletteOpenAtom,
	portableModeAtom,
} from "$/modules/studio/state";
import {
	activeWorkspaceTabAtom,
	workspaceTabsAtom,
} from "$/modules/studio/state";
import {
	activateWorkspaceTab,
	closeAllWorkspaceTabs,
	closeWorkspaceTab,
	createBlankWorkspaceTab,
	getBackupStatus,
	exportPortableBundle,
	importPortableBundle,
	markSessionClean,
	registerWorkspaceTab,
	restoreSessionSnapshot,
	syncActiveTab,
} from "$/modules/studio/workspace";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import { PluginToolbarSlots } from "./PluginStudio";
import styles from "./studio.module.css";

function formatDate(timestamp: number): string {
	try {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(timestamp));
	} catch {
		return new Date(timestamp).toLocaleString();
	}
}

function openProject(
	store: ReturnType<typeof useStore>,
	project: ProjectInfo,
	lyric: ProjectInfo["latestState"],
	fileName: string,
): void {
	// Snapshot the old tab before the global document is replaced.
	registerWorkspaceTab(store, lyric, project.id, fileName);
	store.set(projectIdAtom, project.id);
	store.set(newLyricLinesAtom, lyric);
	store.set(saveFileNameAtom, fileName);
}

export function WorkspaceHomeDialog() {
	const [open, setOpen] = useAtom(workspaceHomeOpenAtom);
	const store = useStore();
	const tabs = useAtomValue(workspaceTabsAtom);
	const activeId = useAtomValue(activeWorkspaceTabAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const setConfirm = useSetAtom(confirmDialogAtom);
	const setDiff = useSetAtom(diffDialogAtom);
	const setPalette = useSetAtom(commandPaletteOpenAtom);
	const setReview = useSetAtom(reviewCockpitOpenAtom);
	const setThemes = useSetAtom(themeStudioOpenAtom);
	const setLayouts = useSetAtom(workspaceManagerOpenAtom);
	const setPlugins = useSetAtom(pluginStudioOpenAtom);
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const [versions, setVersions] = useState<Record<string, ProjectVersion[]>>({});
	const [busy, setBusy] = useState(false);
	const [backupVersion, setBackupVersion] = useState(0);
	const [portableMode, setPortableModeLocal] = useAtom(portableModeAtom);
	const fileRef = useRef<HTMLInputElement | null>(null);
	const savedWorkspaces = useAtomValue(savedWorkspacesAtom);

	useEffect(() => {
		void backupVersion;
		if (!open) return;
		let cancelled = false;
		setBusy(true);
		getProjectList()
			.then((list) => {
				if (!cancelled) setProjects(list);
			})
			.catch(() => {
				if (!cancelled) setProjects([]);
			})
			.finally(() => {
				if (!cancelled) setBusy(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, backupVersion]);

	const backupStatus = useMemo(() => {
		void backupVersion;
		return open ? getBackupStatus() : null;
	}, [open, backupVersion]);

	// Close the home dialog first; opening a second Radix dialog in the same
	// pointer event lets its outside-click handler dismiss the new dialog.
	const launch = (setOpenTarget: (value: boolean) => void) => {
		setOpen(false);
		window.setTimeout(() => setOpenTarget(true), 80);
	};

	const loadVersions = async (project: ProjectInfo) => {
		try {
			const list = await getProjectVersions(project.id);
			setVersions((current) => ({ ...current, [project.id]: list.slice(0, 8) }));
		} catch {
			toast.error("Could not read that project's versions.");
		}
	};

	const confirmReplace = (action: () => void) => {
		if (isDirty) {
			setConfirm({
				open: true,
				title: "Replace the current project?",
				description:
					"Your current edits will be saved into their workspace tab first, then the selected project will open.",
				confirmText: "Open project",
				onConfirm: action,
			});
			return;
		}
		action();
	};

	const openLatest = (project: ProjectInfo) => {
		confirmReplace(() => {
			openProject(
				store,
				project,
				project.latestState,
				project.saveFileName ?? `${project.name || "project"}.ttml`,
			);
			setOpen(false);
			toast.success(`Opened “${project.name}”.`);
		});
	};

	const openVersion = (project: ProjectInfo, version: ProjectVersion) => {
		confirmReplace(() => {
			openProject(
				store,
				project,
				version.data,
				version.saveFileName ?? project.saveFileName ?? `${project.name}.ttml`,
			);
			setOpen(false);
			toast.success(`Opened ${formatDate(version.timestamp)}.`);
		});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.studioDialog}>
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Workspace 2.0</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							Open projects as tabs, restore your last session, compare versions,
							and jump into the 2.0 tools.
						</Dialog.Description>
					</div>
					<Dialog.Close>
						<button type="button" className={styles.studioSecondary}>
							Close
						</button>
					</Dialog.Close>
				</div>

				<div className={styles.studioBody}>
					<Flex direction="column" gap="3">
						<div className={styles.studioGrid}>
							<button
								type="button"
								className={styles.studioCard}
								onClick={() => launch(setPalette)}
							>
								<Text weight="bold">Command palette</Text>
								<Text size="1" color="gray">
									Every command, setting, project, theme, and line.
								</Text>
							</button>
							<button
								type="button"
								className={styles.studioCard}
								onClick={() => launch(setReview)}
							>
								<Text weight="bold">Review & QA</Text>
								<Text size="1" color="gray">
									Project-wide checks, comments, resolved marks, report.
								</Text>
							</button>
							<button
								type="button"
								className={styles.studioCard}
								onClick={() => launch(setThemes)}
							>
								<Text weight="bold">Theme Studio</Text>
								<Text size="1" color="gray">
									Gallery, light/dark pairs, tokens, and CSS.
								</Text>
							</button>
							<button
								type="button"
								className={styles.studioCard}
								onClick={() => launch(setLayouts)}
							>
								<Text weight="bold">Workspaces & focus</Text>
								<Text size="1" color="gray">
									Save panel layouts; hide everything but the editor.
								</Text>
							</button>
							<button
								type="button"
								className={styles.studioCard}
								onClick={() => launch(setPlugins)}
							>
								<Text weight="bold">Plugin API 2.0</Text>
								<Text size="1" color="gray">
									Permissions, UI slots, and the developer kit.
								</Text>
							</button>
							<div className={styles.studioCard}>
								<Text weight="bold">Portable mode</Text>
								<Text size="1" color="gray">
									Keep settings, projects, tabs, and themes in one movable
									bundle.
								</Text>
								<div className={styles.studioRow}>
									<label className={styles.exportCheck}>
										<input
											type="checkbox"
											checked={portableMode}
											onChange={(event) =>
												setPortableModeLocal(event.target.checked)
											}
										/>
										Enabled
									</label>
									<button
										type="button"
										className={styles.studioSecondary}
										onClick={() => {
											void exportPortableBundle(store)
												.then((saved) => {
													if (saved) toast.success("Portable bundle saved.");
												})
												.catch((error) =>
													toast.error(
														error instanceof Error
															? error.message
															: String(error),
													),
												);
										}}
									>
										Export bundle
									</button>
									<button
										type="button"
										className={styles.studioSecondary}
										onClick={() => fileRef.current?.click()}
									>
										Restore bundle
									</button>
									<input
										ref={fileRef}
										type="file"
										accept=".json,application/json"
										hidden
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (!file) return;
											void importPortableBundle(store, file).then((error) => {
												if (error) toast.error(error);
												else {
													toast.success(
														"Portable bundle restored. Reload to apply all settings.",
													);
													setBackupVersion((value) => value + 1);
												}
											});
											event.target.value = "";
										}}
									/>
								</div>
								<Text size="1" color="gray">
									{savedWorkspaces.length} saved layout
									{savedWorkspaces.length === 1 ? "" : "s"} included.
								</Text>
							</div>
						</div>

						<div className={styles.homeSection}>
							<Flex align="center" justify="between" gap="2" wrap="wrap">
								<Text weight="bold">Open tabs</Text>
								<div className={styles.studioRow}>
									<button
										type="button"
										className={styles.studioSecondary}
										onClick={() => {
											createBlankWorkspaceTab(store);
											setOpen(false);
										}}
									>
										New tab
									</button>
									<button
										type="button"
										className={styles.studioSecondary}
										onClick={() => {
											closeAllWorkspaceTabs(store);
											setOpen(false);
										}}
									>
										Close all
									</button>
								</div>
							</Flex>
							{tabs.length === 0 ? (
								<Text size="2" color="gray">
									No tabs yet. Open a file or a recent project to start one.
								</Text>
							) : (
								tabs.map((tab) => (
									<div key={tab.id} className={styles.homeProject}>
										<div className={styles.homeProjectMain}>
											<div className={styles.homeProjectName}>
												{tab.name}
												{tab.dirty ? " · unsaved" : ""}
											</div>
											<div className={styles.homeProjectPreview}>
												{tab.fileName} · {formatDate(tab.updatedAt)}
											</div>
										</div>
										<button
											type="button"
											className={styles.studioSecondary}
											onClick={() => {
												const error = activateWorkspaceTab(store, tab.id);
												if (error) toast.error(error);
												else setOpen(false);
											}}
										>
											{tab.id === activeId ? "Current" : "Switch"}
										</button>
										<button
											type="button"
											className={styles.studioSecondary}
											onClick={() => {
												closeWorkspaceTab(store, tab.id);
												setBackupVersion((value) => value + 1);
											}}
										>
											×
										</button>
									</div>
								))
							)}
						</div>

						<div className={styles.homeSection}>
							<Flex align="center" justify="between" gap="2" wrap="wrap">
								<Text weight="bold">Recent projects & autosaves</Text>
								<Text size="1" color="gray">
									{busy ? "Reading project history…" : `${projects.length} saved`}
								</Text>
							</Flex>
							{projects.length === 0 && !busy ? (
								<Text size="2" color="gray">
									No saved projects yet. Autosave creates one after your first
									edit.
								</Text>
							) : (
								projects.slice(0, 12).map((project) => (
									<div key={project.id} className={styles.homeProject}>
										<div className={styles.homeProjectMain}>
											<div className={styles.homeProjectName}>
												{project.name || "Untitled"}
											</div>
											<div className={styles.homeProjectPreview}>
												{project.preview || "No lyric preview"} ·{" "}
												{formatDate(project.lastModified)}
											</div>
										</div>
										<button
											type="button"
											className={styles.studioPrimary}
											onClick={() => openLatest(project)}
										>
											Open
										</button>
										<button
											type="button"
											className={styles.studioSecondary}
											onClick={() => void loadVersions(project)}
										>
											Versions
										</button>
										{versions[project.id]?.length ? (
											<button
												type="button"
												className={styles.studioSecondary}
												onClick={() => {
													const latest = versions[project.id][0];
													if (!latest) return;
													const currentText = exportTTMLText(lyric);
													setDiff({
														leftTitle: "Current editor",
														leftText: currentText,
														rightTitle: `${project.name} · ${formatDate(
															latest.timestamp,
														)}`,
														rightText: exportTTMLText(latest.data),
													});
												}}
											>
												Diff
											</button>
										) : null}
										{versions[project.id]?.length ? (
											<div
												style={{
													flexBasis: "100%",
													display: "flex",
													flexDirection: "column",
													gap: 4,
													marginBlockStart: 6,
												}}
											>
												{versions[project.id].map((version) => (
													<div
														key={`${project.id}-${version.timestamp}-${version.id ?? ""}`}
														className={styles.homeVersion}
													>
														<span style={{ flex: 1 }}>
															{formatDate(version.timestamp)}
														</span>
														<button
															type="button"
															className={styles.studioSecondary}
															onClick={() => openVersion(project, version)}
														>
															Restore
														</button>
														<button
															type="button"
															className={styles.studioSecondary}
															onClick={() =>
																setDiff({
																	leftTitle: "Current editor",
																	leftText: exportTTMLText(lyric),
																	rightTitle: formatDate(version.timestamp),
																	rightText: exportTTMLText(version.data),
																})
															}
														>
															Compare
														</button>
													</div>
												))}
											</div>
										) : null}
									</div>
								))
							)}
						</div>

						<div className={styles.studioCard}>
							<Flex align="center" justify="between" gap="2" wrap="wrap">
								<Text weight="bold">Session recovery & backups</Text>
								<button
									type="button"
									className={styles.studioSecondary}
									onClick={() => setBackupVersion((value) => value + 1)}
								>
									Re-check
								</button>
							</Flex>
							<Text size="1" color="gray">
								{localStorage.getItem("ttml2SessionSnapshot")
									? "A session snapshot is stored locally."
									: "No session snapshot yet."}{" "}
								{backupStatus?.savedAt
									? `Last scheduled backup: ${formatDate(
											backupStatus.savedAt,
										)} · ${backupStatus.ok ? "integrity OK" : "integrity failed"}.`
									: "Scheduled backups run every 15 minutes while you edit."}
							</Text>
							<Text size="1" color="gray">
								{backupStatus?.count ?? 0} rolling backup
								{(backupStatus?.count ?? 0) === 1 ? "" : "s"} kept. Autosaves and
								the recycle bin remain the primary recovery path.
							</Text>
						</div>
					</Flex>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function WorkspaceTabBar() {
	const store = useStore();
	const tabs = useAtomValue(workspaceTabsAtom);
	const activeId = useAtomValue(activeWorkspaceTabAtom);
	const [, setHomeOpen] = useAtom(workspaceHomeOpenAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const crash = useAtomValue(crashRecoveryAtom);

	// Keep the active tab snapshot current without serializing on every keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: lyric/save/dirty changes deliberately schedule the debounced snapshot
	useEffect(() => {
		if (!activeId) return;
		const timer = window.setTimeout(() => {
			syncActiveTab(store);
		}, 600);
		return () => window.clearTimeout(timer);
	}, [store, activeId, lyric, saveFileName, isDirty]);

	// Restore the last session once, unless a crash snapshot is waiting.
	useEffect(() => {
		if (crash) return;
		const state = store.get(activeWorkspaceTabAtom);
		if (!state) return;
		const current = store.get(lyricLinesAtom);
		if (current.lyricLines.length > 0 || current.metadata.length > 0) return;
		const tab = store.get(workspaceTabsAtom).find((item) => item.id === state);
		if (!tab) return;
		const error = activateWorkspaceTab(store, tab.id);
		if (error) console.warn("[Workspace] Could not restore tab", error);
	}, [store, crash]);

	return (
		<div
				className={styles.workspaceBar}
				data-workspace-bar=""
				data-focus-hidden="false"
				data-ttml-chrome="tabs"
			>
				<button
					type="button"
					className={styles.workspaceHomeButton}
					onClick={() => setHomeOpen(true)}
					title="Workspace home (recent projects, session, tools)"
				>
					⌂ Workspace
				</button>
				<div className={styles.workspaceTabs} role="tablist" aria-label="Open projects">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={tab.id === activeId}
							className={styles.workspaceTab}
							data-active={tab.id === activeId}
							onClick={() => {
								const error = activateWorkspaceTab(store, tab.id);
								if (error) toast.error(error);
							}}
							title={`${tab.name} — ${tab.fileName}`}
						>
							{tab.dirty ? <span className={styles.workspaceTabDirty} /> : null}
							<span className={styles.workspaceTabLabel}>{tab.name}</span>
							<span
								className={styles.workspaceTabClose}
								role="button"
								tabIndex={0}
								onClick={(event) => {
									event.stopPropagation();
									if (tab.dirty) {
										store.set(confirmDialogAtom, {
											open: true,
											title: "Close this tab?",
											description: `${tab.name} has unsaved changes. The tab snapshot is kept until you close it.`,
											confirmText: "Close tab",
											onConfirm: () => closeWorkspaceTab(store, tab.id),
										});
									} else {
										closeWorkspaceTab(store, tab.id);
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										event.stopPropagation();
										closeWorkspaceTab(store, tab.id);
									}
								}}
								aria-label={`Close ${tab.name}`}
							>
								×
							</span>
						</button>
					))}
				</div>
				<button
					type="button"
					className={styles.workspaceNewTab}
					onClick={() => createBlankWorkspaceTab(store)}
					title="New tab"
				>
					＋
				</button>
				<PluginToolbarSlots />
				<button
					type="button"
					className={styles.workspaceAction}
					onClick={() => setHomeOpen(true)}
					title="Workspace home"
				>
					2.0
				</button>
		</div>
	);
}

export function CrashRecoveryDialog() {
	const [snapshot, setSnapshot] = useAtom(crashRecoveryAtom);
	const store = useStore();
	if (!snapshot) return null;
	return (
		<Dialog.Root open onOpenChange={(open) => !open && setSnapshot(null)}>
			<Dialog.Content maxWidth="520px">
				<Dialog.Title>Recover your last session?</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					TTML Tool closed unexpectedly on {formatDate(snapshot.savedAt)}. A
					local snapshot of your tabs and current project is available.
				</Dialog.Description>
				<Flex gap="2" justify="end" mt="4">
					<button
						type="button"
						className={styles.studioSecondary}
						onClick={() => {
							setSnapshot(null);
							markSessionClean();
						}}
					>
						Discard
					</button>
					<button
						type="button"
						className={styles.studioPrimary}
						onClick={() => {
							restoreSessionSnapshot(store, snapshot as SessionSnapshot);
							markSessionClean();
						}}
					>
						Restore session
					</button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

interface DiffOp {
	kind: "same" | "add" | "remove";
	text: string;
	leftNumber?: number;
	rightNumber?: number;
}

function diffLines(left: string, right: string): DiffOp[] {
	const leftLines = left.split(/\r?\n/);
	const rightLines = right.split(/\r?\n/);
	const max = 2400;
	const a = leftLines.slice(0, max);
	const b = rightLines.slice(0, max);
	const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0),
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			dp[i][j] =
				a[i] === b[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			ops.push({ kind: "same", text: a[i], leftNumber: i + 1, rightNumber: j + 1 });
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			ops.push({ kind: "remove", text: a[i], leftNumber: i + 1 });
			i++;
		} else {
			ops.push({ kind: "add", text: b[j], rightNumber: j + 1 });
			j++;
		}
	}
	while (i < a.length) {
		ops.push({ kind: "remove", text: a[i], leftNumber: i + 1 });
		i++;
	}
	while (j < b.length) {
		ops.push({ kind: "add", text: b[j], rightNumber: j + 1 });
		j++;
	}
	return ops;
}

export function DiffDialog() {
	const [request, setRequest] = useAtom(diffDialogAtom);
	const ops = useMemo(
		() =>
			request
				? diffLines(request.leftText, request.rightText)
				: ([] as DiffOp[]),
		[request],
	);
	if (!request) return null;
	const added = ops.filter((op) => op.kind === "add").length;
	const removed = ops.filter((op) => op.kind === "remove").length;
	return (
		<Dialog.Root open onOpenChange={(open) => !open && setRequest(null)}>
			<Dialog.Content className={styles.studioDialog}>
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Version diff</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							{added} added line{added === 1 ? "" : "s"} · {removed} removed line
							{removed === 1 ? "" : "s"}. Removed text is red; added text is
							green.
						</Dialog.Description>
					</div>
					<Dialog.Close>
						<button type="button" className={styles.studioSecondary}>
							Close
						</button>
					</Dialog.Close>
				</div>
				<div className={styles.diffWrap}>
					<div className={styles.diffPane}>
						<div className={styles.diffTitle}>{request.leftTitle}</div>
						{ops.map((op, index) =>
							op.kind === "add" ? null : (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: diff rows are positional and may repeat text
									key={`left-${index}`}
									className={styles.diffLine}
									data-kind={op.kind}
								>
									<span className={styles.diffNumber}>{op.leftNumber ?? ""}</span>
									<span>{op.text || "\u00a0"}</span>
								</div>
							),
						)}
					</div>
					<div className={styles.diffPane}>
						<div className={styles.diffTitle}>{request.rightTitle}</div>
						{ops.map((op, index) =>
							op.kind === "remove" ? null : (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: diff rows are positional and may repeat text
									key={`right-${index}`}
									className={styles.diffLine}
									data-kind={op.kind}
								>
									<span className={styles.diffNumber}>
										{op.rightNumber ?? ""}
									</span>
									<span>{op.text || "\u00a0"}</span>
								</div>
							),
						)}
					</div>
				</div>
				<Flex justify="end" gap="2">
					<button
						type="button"
						className={styles.studioSecondary}
						onClick={() => setRequest(null)}
					>
						Done
					</button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function useWorkspaceSession(): void {
	const store = useStore();
	useEffect(() => {
		const timer = window.setInterval(() => {
			syncActiveTab(store);
		}, 5000);
		const onBeforeUnload = () => markSessionClean();
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("beforeunload", onBeforeUnload);
		};
	}, [store]);
}
