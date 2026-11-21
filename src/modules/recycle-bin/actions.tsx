import { toast } from "react-toastify";
import { uid } from "uid";
import pako from "pako";
import { globalStore } from "$/states/store";
import { lyricLinesAtom, projectIdAtom, saveFileNameAtom } from "$/states/main";
import {
	getProjectVersions,
	restoreProjectsData,
	updateProjectLyrics,
	type ProjectInfo,
	type ProjectVersion,
} from "$/modules/project/autosave/autosave";
import { splitLibraryAtom } from "$/modules/split-library/states";
import { installUserTheme } from "$/modules/themes/storage";
import type { ThemePack } from "$/modules/themes/types";
import type { SavedSplitPattern } from "$/modules/split-library/types";
import type { LyricLine, TTMLLyric } from "$/types/ttml";
import {
	enforceSizeCap,
	insertRemovedLines,
	insertRemovedWords,
	linePreview,
	newRecycleId,
	pruneExpired,
	wordPreview,
} from "./logic";
import { loadRecycleBin, saveRecycleBin } from "./storage";
import type {
	LineRecycleItem,
	ProjectRecycleItem,
	RecycleItem,
	RemovedLine,
	RemovedWord,
	SplitRecycleItem,
	ThemeRecycleItem,
	WordRecycleItem,
} from "./types";

function sizeOf(value: unknown): number {
	try {
		return new TextEncoder().encode(JSON.stringify(value)).byteLength;
	} catch {
		return 0;
	}
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

/** Adds records without blocking the delete action. */
export async function addRecycleItems(items: RecycleItem[]): Promise<void> {
	if (items.length === 0) return;
	const bin = await loadRecycleBin();
	const merged = [...items, ...bin.items];
	const pruned = pruneExpired(merged, bin.settings.retentionDays);
	const capped = enforceSizeCap(pruned.kept, bin.settings.maxBytes);
	await saveRecycleBin({ ...bin, items: capped.kept });
}

function selectedLineRemovals(
	lines: readonly LyricLine[],
	selected: ReadonlySet<string>,
): RemovedLine[] {
	const removals: RemovedLine[] = [];
	lines.forEach((line, index) => {
		if (!selected.has(line.id)) return;
		let previousId: string | null = null;
		for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
			if (!selected.has(lines[cursor].id)) {
				previousId = lines[cursor].id;
				break;
			}
		}
		let nextId: string | null = null;
		for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
			if (!selected.has(lines[cursor].id)) {
				nextId = lines[cursor].id;
				break;
			}
		}
		removals.push({
			line: structuredClone(line),
			index,
			previousId,
			nextId,
			originalId: line.id,
		});
	});
	return removals;
}

export function buildLineRecycleItem(
	lyrics: TTMLLyric,
	selectedLineIds: ReadonlySet<string>,
	projectId: string,
	projectName: string,
): LineRecycleItem | null {
	const lines = selectedLineRemovals(lyrics.lyricLines, selectedLineIds);
	if (lines.length === 0) return null;
	return {
		id: newRecycleId(),
		kind: "line",
		name: linePreview(lines),
		deletedAt: Date.now(),
		projectId,
		projectName,
		size: sizeOf(lines),
		payload: { lines },
	};
}

export function buildWordRecycleItem(
	lyrics: TTMLLyric,
	selectedWordIds: ReadonlySet<string>,
	projectId: string,
	projectName: string,
): WordRecycleItem | null {
	const words: RemovedWord[] = [];
	for (const line of lyrics.lyricLines) {
		const selected = line.words
			.map((word, index) => ({ word, index }))
			.filter((entry) => selectedWordIds.has(entry.word.id));
		if (selected.length === 0) continue;
		const selectedIds = new Set(selected.map((entry) => entry.word.id));
		for (const { word, index } of selected) {
			let previousId: string | null = null;
			for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
				if (!selectedIds.has(line.words[cursor].id)) {
					previousId = line.words[cursor].id;
					break;
				}
			}
			let nextId: string | null = null;
			for (let cursor = index + 1; cursor < line.words.length; cursor += 1) {
				if (!selectedIds.has(line.words[cursor].id)) {
					nextId = line.words[cursor].id;
					break;
				}
			}
			words.push({
				word: structuredClone(word),
				lineId: line.id,
				lineText: line.words.map((entry) => entry.word).join("").trim(),
				index,
				previousId,
				nextId,
				originalId: word.id,
			});
		}
	}
	if (words.length === 0) return null;
	return {
		id: newRecycleId(),
		kind: "word",
		name: wordPreview(words),
		deletedAt: Date.now(),
		projectId,
		projectName,
		size: sizeOf(words),
		payload: { words },
	};
}

export async function buildProjectRecycleItem(
	project: ProjectInfo,
): Promise<ProjectRecycleItem> {
	const versions = await getProjectVersions(project.id);
	const archive = JSON.stringify({ project, versions });
	const compressed = toBase64(pako.gzip(archive));
	return {
		id: newRecycleId(),
		kind: "project",
		name: project.name || "Untitled project",
		deletedAt: Date.now(),
		size: compressed.length,
		payload: {
			compressed,
		},
	};
}

export function buildSplitRecycleItem(
	pattern: SavedSplitPattern,
): SplitRecycleItem {
	return {
		id: newRecycleId(),
		kind: "split",
		name: pattern.label.trim() || pattern.displayWord,
		deletedAt: Date.now(),
		size: sizeOf(pattern),
		payload: { pattern: structuredClone(pattern), wasDefault: pattern.isDefault },
	};
}

export function buildThemeRecycleItem(theme: ThemePack): ThemeRecycleItem {
	return {
		id: newRecycleId(),
		kind: "theme",
		name: theme.name,
		deletedAt: Date.now(),
		size: sizeOf({ theme }),
		payload: { theme: structuredClone(theme) },
	};
}

export interface RestoreResult {
	ok: boolean;
	message: string;
}

function currentProjectName(): string {
	return globalStore.get(saveFileNameAtom) || "Untitled project";
}

function restoreLines(item: LineRecycleItem, targetProjectId: string): RestoreResult {
	const currentId = globalStore.get(projectIdAtom);
	if (!targetProjectId || targetProjectId === currentId) {
		const lyrics = globalStore.get(lyricLinesAtom);
		const result = insertRemovedLines(lyrics.lyricLines, item.payload.lines);
		globalStore.set(lyricLinesAtom, { ...lyrics, lyricLines: result.lines });
		const last = result.placements[result.placements.length - 1];
		return {
			ok: true,
			message: last?.message ?? "Restored the line into this project.",
		};
	}
	return { ok: false, message: "Use the project list to restore into another project." };
}

async function restoreLinesIntoProject(
	item: LineRecycleItem,
	targetProjectId: string,
): Promise<RestoreResult> {
	const saved = await updateProjectLyrics(targetProjectId, (lyrics) => {
		const result = insertRemovedLines(lyrics.lyricLines, item.payload.lines);
		return { ...lyrics, lyricLines: result.lines };
	});
	return saved
		? { ok: true, message: "Restored the line into the chosen project." }
		: { ok: false, message: "That project no longer exists." };
}

async function restoreWords(
	item: WordRecycleItem,
	targetProjectId?: string,
): Promise<RestoreResult> {
	const currentId = globalStore.get(projectIdAtom);
	const useCurrent = !targetProjectId || targetProjectId === currentId;
	if (useCurrent) {
		const lyrics = globalStore.get(lyricLinesAtom);
		let touched = false;
		const byLine = new Map<string, RemovedWord[]>();
		for (const word of item.payload.words) {
			const list = byLine.get(word.lineId) ?? [];
			list.push(word);
			byLine.set(word.lineId, list);
		}
		const lyricLines = lyrics.lyricLines.map((line) => {
			const removed = byLine.get(line.id);
			if (!removed) return line;
			touched = true;
			return insertRemovedWords(line, removed).line;
		});
		if (!touched) {
			return { ok: false, message: "The line this word belonged to is gone." };
		}
		globalStore.set(lyricLinesAtom, { ...lyrics, lyricLines });
		return { ok: true, message: "Restored the word at its old position." };
	}
	const saved = await updateProjectLyrics(targetProjectId, (lyrics) => {
		const byLine = new Map<string, RemovedWord[]>();
		for (const word of item.payload.words) {
			const list = byLine.get(word.lineId) ?? [];
			list.push(word);
			byLine.set(word.lineId, list);
		}
		return {
			...lyrics,
			lyricLines: lyrics.lyricLines.map((line) => {
				const removed = byLine.get(line.id);
				return removed ? insertRemovedWords(line, removed).line : line;
			}),
		};
	});
	return saved
		? { ok: true, message: "Restored the word into the chosen project." }
		: { ok: false, message: "That project no longer exists." };
}

async function restoreProject(item: ProjectRecycleItem): Promise<RestoreResult> {
	try {
		const archive = JSON.parse(
			pako.ungzip(fromBase64(item.payload.compressed), { to: "string" }),
		) as { project: ProjectInfo; versions: ProjectVersion[] };
		await restoreProjectsData([archive.project], archive.versions);
		return {
			ok: true,
			message: "Restored the project and its saved history.",
		};
	} catch {
		return { ok: false, message: "The saved project copy could not be read." };
	}
}

function restoreSplit(item: SplitRecycleItem): RestoreResult {
	const library = globalStore.get(splitLibraryAtom);
	const exists = library.patterns.some(
		(pattern) => pattern.id === item.payload.pattern.id,
	);
	const pattern = {
		...item.payload.pattern,
		id: exists ? uid() : item.payload.pattern.id,
		updatedAt: Date.now(),
		isDefault: item.payload.wasDefault,
	};
	globalStore.set(splitLibraryAtom, {
		...library,
		patterns: [...library.patterns, pattern],
	});
	return { ok: true, message: "Restored the saved split." };
}

async function restoreTheme(item: ThemeRecycleItem): Promise<RestoreResult> {
	try {
		await installUserTheme(item.payload.theme, item.payload.theme.css);
		window.dispatchEvent(new CustomEvent("ttml:themes-changed"));
		return { ok: true, message: "Reinstalled the theme." };
	} catch {
		return { ok: false, message: "The theme could not be reinstalled." };
	}
}

export async function restoreRecycleItem(
	item: RecycleItem,
	targetProjectId?: string,
): Promise<RestoreResult> {
	switch (item.kind) {
		case "line": {
			const current = globalStore.get(projectIdAtom);
			return targetProjectId && targetProjectId !== current
				? restoreLinesIntoProject(item, targetProjectId)
				: restoreLines(item, current);
		}
		case "word":
			return restoreWords(item, targetProjectId);
		case "project":
			return restoreProject(item);
		case "split":
			return restoreSplit(item);
		case "theme":
			return restoreTheme(item);
	}
}

/** Removes an item permanently. */
export async function deleteRecycleItem(id: string): Promise<void> {
	const bin = await loadRecycleBin();
	await saveRecycleBin({
		...bin,
		items: bin.items.filter((item) => item.id !== id),
	});
}

export async function emptyRecycleBin(): Promise<void> {
	const bin = await loadRecycleBin();
	await saveRecycleBin({ ...bin, items: [] });
}

export async function updateRecycleSettings(
	settings: Partial<{ retentionDays: 7 | 30 | 90 | "never"; maxBytes: number }>,
): Promise<void> {
	const bin = await loadRecycleBin();
	const next = { ...bin.settings, ...settings };
	const pruned = pruneExpired(bin.items, next.retentionDays);
	const capped = enforceSizeCap(pruned.kept, next.maxBytes);
	await saveRecycleBin({ ...bin, settings: next, items: capped.kept });
}

/** Toast with a real Undo button; the record also stays in the bin. */
export function showUndoToast(
	message: string,
	onUndo: () => void | Promise<void>,
): void {
	const id = toast.info(
		<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
			<span>{message}</span>
			<button
				type="button"
				onClick={() => {
					toast.dismiss(id);
					void onUndo();
				}}
				style={{
					background: "transparent",
					border: "1px solid currentColor",
					borderRadius: 6,
					color: "inherit",
					cursor: "pointer",
					font: "inherit",
					fontWeight: 600,
					padding: "2px 8px",
				}}
			>
				Undo
			</button>
		</div>,
		{ autoClose: 6000, closeOnClick: false },
	);
}

export function projectLabel(): { id: string; name: string } {
	return {
		id: globalStore.get(projectIdAtom),
		name: currentProjectName(),
	};
}
