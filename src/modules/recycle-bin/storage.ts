import { isTauri } from "@tauri-apps/api/core";
import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	rename,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { normalizeBin } from "./logic";
import {
	EMPTY_RECYCLE_BIN,
	RECYCLE_BIN_FALLBACK_KEY,
	RECYCLE_BIN_FILE,
	RECYCLE_BIN_FOLDER,
	type RecycleBinFile,
} from "./types";

const FILE_PATH = `${RECYCLE_BIN_FOLDER}/${RECYCLE_BIN_FILE}`;
const TEMP_PATH = `${FILE_PATH}.tmp`;

let writeQueue: Promise<void> = Promise.resolve();

export async function loadRecycleBin(): Promise<RecycleBinFile> {
	if (isTauri()) {
		try {
			await mkdir(RECYCLE_BIN_FOLDER, {
				baseDir: BaseDirectory.AppData,
				recursive: true,
			});
			if (await exists(FILE_PATH, { baseDir: BaseDirectory.AppData })) {
				const text = await readTextFile(FILE_PATH, {
					baseDir: BaseDirectory.AppData,
				});
				return normalizeBin(JSON.parse(text));
			}
		} catch (error) {
			console.warn("Could not read the recycle bin", error);
		}
		return normalizeBin(null);
	}
	try {
		const text = localStorage.getItem(RECYCLE_BIN_FALLBACK_KEY);
		return text ? normalizeBin(JSON.parse(text)) : normalizeBin(null);
	} catch {
		return normalizeBin(null);
	}
}

async function writeBin(file: RecycleBinFile): Promise<void> {
	const text = JSON.stringify(file, null, 2);
	if (isTauri()) {
		await mkdir(RECYCLE_BIN_FOLDER, {
			baseDir: BaseDirectory.AppData,
			recursive: true,
		});
		await writeTextFile(TEMP_PATH, text, {
			baseDir: BaseDirectory.AppData,
		});
		await rename(TEMP_PATH, FILE_PATH, {
			oldPathBaseDir: BaseDirectory.AppData,
			newPathBaseDir: BaseDirectory.AppData,
		});
		return;
	}
	localStorage.setItem(RECYCLE_BIN_FALLBACK_KEY, text);
}

/**
 * Queues writes so a quick delete/restore/undo sequence cannot interleave two
 * JSON writes and leave a half-written file.
 */
export function saveRecycleBin(file: RecycleBinFile): Promise<void> {
	writeQueue = writeQueue
		.catch(() => {})
		.then(() => writeBin(file))
		.catch((error) => {
			console.warn("Could not write the recycle bin", error);
		});
	return writeQueue;
}

export function defaultRecycleBin(): RecycleBinFile {
	return normalizeBin(EMPTY_RECYCLE_BIN);
}
