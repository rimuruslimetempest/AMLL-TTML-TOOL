import { isTauri } from "@tauri-apps/api/core";
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { EMPTY_SPLIT_LIBRARY, type SplitLibraryFile } from "./types";
import { parseSplitLibraryJson } from "./logic";

const FILE_NAME = "split-library.json";
const FALLBACK_KEY = "amll_split_library_v1";

export async function loadSplitLibrary(): Promise<SplitLibraryFile> {
	if (isTauri()) {
		try {
			if (!(await exists(FILE_NAME, { baseDir: BaseDirectory.AppData }))) {
				return { ...EMPTY_SPLIT_LIBRARY, patterns: [], settings: { ...EMPTY_SPLIT_LIBRARY.settings } };
			}
			const text = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
			return parseSplitLibraryJson(text);
		} catch (error) {
			const fallback = localStorage.getItem(FALLBACK_KEY);
			if (fallback) {
				try {
					return parseSplitLibraryJson(fallback);
				} catch {}
			}
			console.warn("Could not read the personal split library", error);
			return { ...EMPTY_SPLIT_LIBRARY, patterns: [], settings: { ...EMPTY_SPLIT_LIBRARY.settings } };
		}
	}
	try {
		const text = localStorage.getItem(FALLBACK_KEY);
		return text ? parseSplitLibraryJson(text) : { ...EMPTY_SPLIT_LIBRARY, patterns: [], settings: { ...EMPTY_SPLIT_LIBRARY.settings } };
	} catch {
		return { ...EMPTY_SPLIT_LIBRARY, patterns: [], settings: { ...EMPTY_SPLIT_LIBRARY.settings } };
	}
}

export async function saveSplitLibrary(library: SplitLibraryFile): Promise<void> {
	if (isTauri()) {
		try {
			await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
			await writeTextFile(FILE_NAME, JSON.stringify(library, null, 2), {
				baseDir: BaseDirectory.AppData,
			});
			return;
		} catch (error) {
			console.error("Could not write the split library to app data", error);
			throw error;
		}
	}
	localStorage.setItem(FALLBACK_KEY, JSON.stringify(library));
}
