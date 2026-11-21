import { uid } from "uid";
import type { LyricLine, LyricWord } from "$/types/ttml";
import {
	DEFAULT_RECYCLE_SETTINGS,
	EMPTY_RECYCLE_BIN,
	RECYCLE_BIN_VERSION,
	type RecycleBinFile,
	type RecycleItem,
	type RecycleKind,
	type RemovedLine,
	type RemovedWord,
	type RetentionDays,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function newRecycleId(): string {
	return `rb_${uid()}`;
}

export function isRetentionDays(value: unknown): value is RetentionDays {
	return value === 7 || value === 30 || value === 90 || value === "never";
}

export function normalizeBin(value: unknown): RecycleBinFile {
	if (!value || typeof value !== "object") {
		return {
			...EMPTY_RECYCLE_BIN,
			items: [],
			settings: { ...DEFAULT_RECYCLE_SETTINGS },
		};
	}
	const raw = value as Partial<RecycleBinFile>;
	const items = Array.isArray(raw.items)
		? raw.items.filter(
				(item): item is RecycleItem =>
					Boolean(item) &&
					typeof item === "object" &&
					typeof (item as RecycleItem).id === "string" &&
					typeof (item as RecycleItem).deletedAt === "number" &&
					["line", "word", "project", "split", "theme"].includes(
						(item as RecycleItem).kind,
					),
			)
		: [];
	return {
		version: RECYCLE_BIN_VERSION,
		items,
		settings: {
			retentionDays: isRetentionDays(raw.settings?.retentionDays)
				? raw.settings.retentionDays
				: DEFAULT_RECYCLE_SETTINGS.retentionDays,
			maxBytes:
				typeof raw.settings?.maxBytes === "number" &&
				raw.settings.maxBytes > 0
					? raw.settings.maxBytes
					: DEFAULT_RECYCLE_SETTINGS.maxBytes,
		},
	};
}

/** Items older than the retention period; `never` keeps everything. */
export function pruneExpired(
	items: readonly RecycleItem[],
	retentionDays: RetentionDays,
	now = Date.now(),
): { kept: RecycleItem[]; removed: RecycleItem[] } {
	if (retentionDays === "never") {
		return { kept: [...items], removed: [] };
	}
	const cutoff = now - retentionDays * DAY_MS;
	const kept: RecycleItem[] = [];
	const removed: RecycleItem[] = [];
	for (const item of items) {
		if (item.deletedAt < cutoff) removed.push(item);
		else kept.push(item);
	}
	return { kept, removed };
}

export function daysLeft(
	item: RecycleItem,
	retentionDays: RetentionDays,
	now = Date.now(),
): number | null {
	if (retentionDays === "never") return null;
	const expires = item.deletedAt + retentionDays * DAY_MS;
	return Math.max(0, Math.ceil((expires - now) / DAY_MS));
}

export function binByteSize(file: RecycleBinFile): number {
	return new TextEncoder().encode(JSON.stringify(file.items)).byteLength;
}

/** Removes the oldest items until the stored payload fits the cap. */
export function enforceSizeCap(
	items: readonly RecycleItem[],
	maxBytes: number,
): { kept: RecycleItem[]; removed: RecycleItem[] } {
	let total = items.reduce((sum, item) => sum + item.size, 0);
	if (total <= maxBytes) return { kept: [...items], removed: [] };
	const oldestFirst = [...items].sort((a, b) => a.deletedAt - b.deletedAt);
	const dropped = new Set<string>();
	for (const item of oldestFirst) {
		if (total <= maxBytes) break;
		dropped.add(item.id);
		total -= item.size;
	}
	return {
		kept: items.filter((item) => !dropped.has(item.id)),
		removed: items.filter((item) => dropped.has(item.id)),
	};
}

export function filterItems(
	items: readonly RecycleItem[],
	options: { kind?: RecycleKind | "all"; query?: string },
): RecycleItem[] {
	const query = options.query?.trim().toLowerCase() ?? "";
	return items
		.filter((item) => {
			if (options.kind && options.kind !== "all" && item.kind !== options.kind) {
				return false;
			}
			if (!query) return true;
			return [item.name, item.projectName, item.kind]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		})
		.sort((a, b) => b.deletedAt - a.deletedAt);
}

function lineText(line: LyricLine): string {
	return line.words
		.map((word) => word.word)
		.join("")
		.trim();
}

export function linePreview(lines: readonly RemovedLine[], max = 60): string {
	const text = lines.map((entry) => lineText(entry.line)).filter(Boolean).join(" / ");
	if (!text) return lines.length === 1 ? "(empty line)" : `${lines.length} lines`;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function wordPreview(words: readonly RemovedWord[], max = 60): string {
	const text = words.map((entry) => entry.word.word).join(", ");
	if (!text) return words.length === 1 ? "(empty word)" : `${words.length} words`;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface LinePlacement {
	lines: LyricLine[];
	placements: Array<{ id: string; index: number; message: string }>;
}

/**
 * Puts removed lines back next to the neighbors they had. The neighbor IDs are
 * used instead of a stored array index, so edits made in the meantime do not
 * move the restored line to the wrong place.
 */
export function insertRemovedLines(
	existing: readonly LyricLine[],
	removed: readonly RemovedLine[],
): LinePlacement {
	const lines = [...existing];
	const placements: LinePlacement["placements"] = [];
	const ordered = [...removed].sort((a, b) => a.index - b.index);
	for (const entry of ordered) {
		const usedIds = new Set(lines.map((line) => line.id));
		const line: LyricLine = {
			...entry.line,
			id: usedIds.has(entry.line.id) ? uid() : entry.line.id,
		};
		const previousIndex = entry.previousId
			? lines.findIndex((candidate) => candidate.id === entry.previousId)
			: -1;
		const nextIndex = entry.nextId
			? lines.findIndex((candidate) => candidate.id === entry.nextId)
			: -1;
		let index: number;
		let message: string;
		if (previousIndex >= 0) {
			index = previousIndex + 1;
			message = "Restored after its previous line.";
		} else if (nextIndex >= 0) {
			index = nextIndex;
			message = "Restored before its next line.";
		} else {
			index = lines.length;
			message = "Its neighbors were gone, so it was added at the end.";
		}
		lines.splice(index, 0, line);
		placements.push({ id: line.id, index, message });
	}
	return { lines, placements };
}

export interface WordPlacement {
	line: LyricLine;
	placements: Array<{ id: string; index: number; message: string }>;
}

export function insertRemovedWords(
	line: LyricLine,
	removed: readonly RemovedWord[],
): WordPlacement {
	const words = [...line.words];
	const placements: WordPlacement["placements"] = [];
	const ordered = [...removed].sort((a, b) => a.index - b.index);
	for (const entry of ordered) {
		const usedIds = new Set(words.map((word) => word.id));
		const word: LyricWord = {
			...entry.word,
			id: usedIds.has(entry.word.id) ? uid() : entry.word.id,
		};
		const previousIndex = entry.previousId
			? words.findIndex((candidate) => candidate.id === entry.previousId)
			: -1;
		const nextIndex = entry.nextId
			? words.findIndex((candidate) => candidate.id === entry.nextId)
			: -1;
		let index: number;
		let message: string;
		if (previousIndex >= 0) {
			index = previousIndex + 1;
			message = "Restored after its previous word.";
		} else if (nextIndex >= 0) {
			index = nextIndex;
			message = "Restored before its next word.";
		} else {
			index = words.length;
			message = "Its neighbors were gone, so it was added at the end of the line.";
		}
		words.splice(index, 0, word);
		placements.push({ id: word.id, index, message });
	}
	return { line: { ...line, words }, placements };
}

export function kindLabel(kind: RecycleKind): string {
	switch (kind) {
		case "line":
			return "Lines";
		case "word":
			return "Words";
		case "project":
			return "Projects";
		case "split":
			return "Saved splits";
		case "theme":
			return "Themes";
	}
}

export function formatDeletedAt(value: number): string {
	return new Date(value).toLocaleString();
}
