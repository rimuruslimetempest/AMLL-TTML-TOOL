import { audioEngine } from "$/modules/audio/audio-engine";
import {
	loadedAudioFileNameAtom,
	loadedAudioPathAtom,
} from "$/modules/audio/states";
import { globalStore } from "$/states/store";
import { collabMediaUrl } from "./logic";
import type { CollabSession, CollabSharedMedia } from "./types";

const MIME_EXTENSIONS: Record<string, string> = {
	"audio/flac": "flac",
	"audio/mp3": "mp3",
	"audio/mp4": "m4a",
	"audio/mpeg": "mp3",
	"audio/ogg": "ogg",
	"audio/opus": "opus",
	"audio/wav": "wav",
	"audio/webm": "webm",
	"audio/x-flac": "flac",
	"audio/x-m4a": "m4a",
	"audio/x-wav": "wav",
};

function sharedAudioName(name: string, contentType: string): string {
	if (/\.[a-z0-9]{1,6}$/i.test(name)) return name;
	const mime = contentType.split(";")[0].trim().toLowerCase();
	const extension = MIME_EXTENSIONS[mime];
	return extension ? `${name}.${extension}` : name;
}

/**
 * Loads a host-shared song directly into the player. The file keeps its real
 * name and extension for metadata/transcoding, but is marked transient so the
 * audio engine and autosave never write it to IndexedDB.
 */
export async function loadSharedAudio(
	session: Pick<CollabSession, "localUrl" | "roomId">,
	item: CollabSharedMedia,
): Promise<void> {
	if (item.kind !== "audio") {
		throw new Error("Only a shared song can be loaded into the player.");
	}
	const response = await fetch(collabMediaUrl(session, item.id), {
		cache: "no-store",
	});
	if (!response.ok) {
		throw new Error(
			`The host could not send this song (HTTP ${response.status}).`,
		);
	}
	const blob = await response.blob();
	if (blob.size === 0) {
		throw new Error("The shared song file is empty.");
	}
	const file = new File([blob], sharedAudioName(item.name, blob.type), {
		type: blob.type || "application/octet-stream",
	});
	Object.assign(file, { transient: true });
	await audioEngine.loadMusic(file);
	globalStore.set(loadedAudioFileNameAtom, file.name);
	globalStore.set(loadedAudioPathAtom, null);
}
