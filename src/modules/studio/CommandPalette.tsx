import { Dialog } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getAllCommands } from "$/modules/keyboard/registry";
import {
	getProjectList,
	getProjectLatestState,
	type ProjectInfo,
} from "$/modules/project/autosave/autosave";
import { SETTINGS_SEARCH_ITEMS } from "$/modules/settings/searchIndex";
import { themeCatalogAtom, themeIdAtom } from "$/modules/themes/state";
import {
	commandPaletteOpenAtom,
	focusModeAtom,
	pluginStudioOpenAtom,
	reviewCockpitOpenAtom,
	workspaceHomeOpenAtom,
	workspaceManagerOpenAtom,
	themeStudioOpenAtom,
} from "$/modules/studio/state";
import {
	registerWorkspaceTab,
	serializeDocument,
} from "$/modules/studio/workspace";
import { confirmDialogAtom, settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
	ToolMode,
} from "$/states/main";
import { audioEngine } from "$/modules/audio/audio-engine";
import { AI_CHECK_SCROLL_EVENT } from "$/modules/ai-check/types";
import type { KeyBindingsConfig } from "$/modules/keyboard/types";
import styles from "./studio.module.css";

interface PaletteItem {
	id: string;
	group: string;
	title: string;
	subtitle?: string;
	keys?: string;
	run: () => void;
}

const KEY_FROM_CODE: Record<string, string> = {
	Space: " ",
	Escape: "Escape",
	Enter: "Enter",
	Tab: "Tab",
	Backspace: "Backspace",
	Delete: "Delete",
	Home: "Home",
	End: "End",
	ArrowUp: "ArrowUp",
	ArrowDown: "ArrowDown",
	ArrowLeft: "ArrowLeft",
	ArrowRight: "ArrowRight",
	BracketRight: "]",
	BracketLeft: "[",
	Quote: "'",
	Equal: "=",
	Minus: "-",
	Comma: ",",
	Period: ".",
	Slash: "/",
	Semicolon: ";",
	Backquote: "`",
};

function displayKeys(keys: readonly string[] | undefined): string {
	if (!keys || keys.length === 0) return "";
	return keys
		.map((key) => {
			if (key === "Control") return "Ctrl";
			if (key === "Meta") return "⌘";
			if (key === "Shift") return "Shift";
			if (key === "Alt") return "Alt";
			if (key.startsWith("Key")) return key.slice(3);
			if (key.startsWith("Digit")) return key.slice(5);
			if (/^F\d+$/.test(key)) return key;
			return KEY_FROM_CODE[key] ?? key;
		})
		.join("+");
}

function dispatchKeybinding(keys: KeyBindingsConfig): void {
	const list = keys as readonly string[];
	const code = list.find(
		(key) =>
			key.startsWith("Key") ||
			key.startsWith("Digit") ||
			/^F\d+$/.test(key) ||
			key in KEY_FROM_CODE,
	);
	if (!code) return;
	const key =
		KEY_FROM_CODE[code] ??
		(code.startsWith("Key")
			? code.slice(3).toLowerCase()
			: code.startsWith("Digit")
				? code.slice(5)
				: code);
	const event = new KeyboardEvent("keydown", {
		key,
		code,
		ctrlKey: list.includes("Control"),
		metaKey: list.includes("Meta"),
		shiftKey: list.includes("Shift"),
		altKey: list.includes("Alt"),
		bubbles: true,
		cancelable: true,
	});
	window.dispatchEvent(event);
}

function matches(query: string, text: string): boolean {
	const haystack = text.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((part) => haystack.includes(part));
}

export function CommandPalette() {
	const [open, setOpen] = useAtom(commandPaletteOpenAtom);
	const store = useStore();
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const themes = useAtomValue(themeCatalogAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const setWorkspaceHome = useSetAtom(workspaceHomeOpenAtom);
	const setReview = useSetAtom(reviewCockpitOpenAtom);
	const setThemes = useSetAtom(themeStudioOpenAtom);
	const setLayouts = useSetAtom(workspaceManagerOpenAtom);
	const setPlugins = useSetAtom(pluginStudioOpenAtom);
	const [focusMode, setFocusMode] = useAtom(focusModeAtom);

	useEffect(() => {
		if (open) return;
		// A dialog that closes while its input still has focus would swallow
		// every global shortcut; hand focus back to the document.
		const active = document.activeElement as HTMLElement | null;
		if (active && active !== document.body) active.blur();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelected(0);
		window.setTimeout(() => inputRef.current?.focus(), 30);
		getProjectList()
			.then((list) => setProjects(list.slice(0, 30)))
			.catch(() => setProjects([]));
	}, [open]);

	const items = useMemo<PaletteItem[]>(() => {
		if (!open) return [];
		const result: PaletteItem[] = [];
		const close = () => setOpen(false);
		// Let the palette finish closing before another dialog mounts, otherwise
		// the same pointer event can be treated as an outside click.
		const openAfterClose = (action: () => void) => {
			setOpen(false);
			window.setTimeout(action, 80);
		};

		result.push(
			{
				id: "studio-home",
				group: "Workspace",
				title: "Workspace home",
				subtitle: "Tabs, recent projects, autosaves, session recovery",
				run: () => openAfterClose(() => setWorkspaceHome(true)),
			},
			{
				id: "studio-review",
				group: "Workspace",
				title: "Open Review & QA cockpit",
				subtitle: "Project-wide checks, comments, report",
				run: () => openAfterClose(() => setReview(true)),
			},
			{
				id: "studio-themes",
				group: "Workspace",
				title: "Open Theme Studio",
				subtitle: "Gallery, pairs, tokens, and CSS",
				run: () => openAfterClose(() => setThemes(true)),
			},
			{
				id: "studio-layouts",
				group: "Workspace",
				title: "Workspaces & focus mode",
				subtitle: "Save panel layouts, hide everything but the editor",
				run: () => openAfterClose(() => setLayouts(true)),
			},
			{
				id: "studio-plugins",
				group: "Workspace",
				title: "Plugin API 2.0",
				subtitle: "Permissions, UI slots, developer kit",
				run: () => openAfterClose(() => setPlugins(true)),
			},
			{
				id: "studio-focus",
				group: "View",
				title: focusMode ? "Leave focus mode" : "Enter focus mode",
				subtitle: "Hide the title bar, ribbon, and tabs",
				run: () => openAfterClose(() => setFocusMode(!focusMode)),
			},
		);

		for (const command of getAllCommands()) {
			if (command.id === "commandPalette") continue;
			const keys = store.get(command.atom) as KeyBindingsConfig;
			result.push({
				id: `cmd-${command.id}`,
				group: "Commands",
				title: t(command.description, command.id),
				subtitle: command.category,
				keys: displayKeys(keys),
				run: () => openAfterClose(() => dispatchKeybinding(keys)),
			});
		}

		for (const item of SETTINGS_SEARCH_ITEMS) {
			result.push({
				id: `setting-${item.id}`,
				group: "Settings",
				title: item.title,
				subtitle: `${item.tabName}${item.description ? ` · ${item.description}` : ""}`,
				run: () =>
					openAfterClose(() => {
						store.set(settingsTabAtom, item.tab);
						store.set(settingsDialogAtom, true);
					}),
			});
		}

		for (const theme of themes) {
			result.push({
				id: `theme-${theme.id}`,
				group: "Themes",
				title: `Use theme: ${theme.name}`,
				subtitle: theme.builtin ? "Built-in" : "Installed",
				run: () => {
					close();
					store.set(themeIdAtom, theme.id);
					toast.success(`Theme: ${theme.name}`);
				},
			});
		}

		for (const project of projects) {
			result.push({
				id: `project-${project.id}`,
				group: "Recent projects",
				title: project.name || "Untitled",
				subtitle: `${project.preview || "No preview"} · ${new Date(
					project.lastModified,
				).toLocaleDateString()}`,
				run: () => {
					close();
					const openProject = () => {
						void getProjectLatestState(project.id).then((state) => {
							if (!state) {
								toast.error("That project's latest state is unavailable.");
								return;
							}
							const fileName =
								project.saveFileName ?? `${project.name || "project"}.ttml`;
							registerWorkspaceTab(store, state, project.id, fileName);
							store.set(projectIdAtom, project.id);
							store.set(newLyricLinesAtom, state);
							store.set(saveFileNameAtom, fileName);
							toast.success(`Opened “${project.name}”.`);
						});
					};
					if (store.get(isDirtyAtom)) {
						store.set(confirmDialogAtom, {
							open: true,
							title: "Open another project?",
							description:
								"Your current edits are kept in the active workspace tab first.",
							confirmText: "Open project",
							onConfirm: openProject,
						});
					} else {
						openProject();
					}
				},
			});
		}

		lyric.lyricLines.forEach((line, index) => {
			const text = line.words.map((word) => word.word).join("").trim();
			if (!text) return;
			result.push({
				id: `line-${line.id}`,
				group: "Lines",
				title: `${index + 1}. ${text}`,
				subtitle: line.isBG ? "Background" : line.translatedLyric || "Lyric line",
				run: () => {
					close();
					store.set(toolModeAtom, ToolMode.Edit);
					store.set(selectedLinesAtom, new Set([line.id]));
					store.set(selectedWordsAtom, new Set());
					window.dispatchEvent(
						new CustomEvent<number>(AI_CHECK_SCROLL_EVENT, { detail: index }),
					);
					if (line.startTime > 0 && audioEngine.musicLoaded) {
						audioEngine.seekMusic(line.startTime / 1000);
					}
				},
			});
		});

		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return result.slice(0, 60);
		}
		const scored = result
			.map((item) => {
				const title = item.title.toLowerCase();
				const full = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
				let score = -1;
				if (title === normalized) score = 100;
				else if (title.startsWith(normalized)) score = 80;
				else if (title.includes(normalized)) score = 60;
				else if (full.includes(normalized)) score = 35;
				else if (matches(normalized, full)) score = 15;
				return { item, score };
			})
			.filter((entry) => entry.score >= 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 50)
			.map((entry) => entry.item);
		return scored;
	}, [
		focusMode,
		lyric.lyricLines,
		projects,
		open,
		query,
		setFocusMode,
		setLayouts,
		setPlugins,
		setReview,
		setThemes,
		setWorkspaceHome,
		setOpen,
		store,
		t,
		themes,
	]);

	useEffect(() => {
		setSelected((current) => Math.min(current, Math.max(0, items.length - 1)));
	}, [items.length]);

	const runItem = (item: PaletteItem | undefined) => {
		if (!item) return;
		item.run();
	};

	let lastGroup = "";
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.paletteDialog} aria-label="Command palette">
				<input
					ref={inputRef}
					className={styles.paletteInput}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setSelected(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setSelected((current) => Math.min(current + 1, items.length - 1));
						} else if (event.key === "ArrowUp") {
							event.preventDefault();
							setSelected((current) => Math.max(current - 1, 0));
						} else if (event.key === "Enter") {
							event.preventDefault();
							runItem(items[selected]);
						}
					}}
					placeholder="Search commands, settings, projects, themes, or lines…"
					aria-label="Command palette search"
					autoComplete="off"
					spellCheck={false}
				/>
				<div className={styles.paletteList} role="listbox">
					{items.length === 0 ? (
						<div className={styles.reviewEmpty}>No matches.</div>
					) : (
						items.map((item, index) => {
							const header = item.group !== lastGroup ? item.group : "";
							lastGroup = item.group;
							return (
								<div key={item.id}>
									{header ? (
										<div className={styles.paletteGroup}>{header}</div>
									) : null}
									<button
										type="button"
										role="option"
										aria-selected={index === selected}
										className={styles.paletteItem}
										data-selected={index === selected}
										onMouseEnter={() => setSelected(index)}
										onClick={() => runItem(item)}
									>
										<span className={styles.paletteText}>
											<span className={styles.paletteTitle}>{item.title}</span>
											{item.subtitle ? (
												<span className={styles.paletteSubtitle}>
													{item.subtitle}
												</span>
											) : null}
										</span>
										{item.keys ? (
											<span className={styles.paletteKeys}>{item.keys}</span>
										) : null}
									</button>
								</div>
							);
						})
					)}
				</div>
				<div
					style={{
						padding: "8px 12px",
						borderBlockStart: "1px solid var(--gray-a5)",
						fontSize: 11,
						color: "var(--gray-9)",
						display: "flex",
						justifyContent: "space-between",
						gap: 8,
					}}
				>
					<span>↑↓ navigate · Enter run · Esc close</span>
					<span>{serializeDocument(lyric).length.toLocaleString()} chars in project</span>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
