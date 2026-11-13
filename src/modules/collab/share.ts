import { invoke } from "@tauri-apps/api/core";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	loadedAudioAtom,
	loadedAudioFileNameAtom,
	loadedAudioPathAtom,
} from "$/modules/audio/states";
import { globalStore } from "$/states/store";

export async function shareCurrentAudio(): Promise<void> {
	const file = audioEngine.currentFile;
	const name =
		globalStore.get(loadedAudioFileNameAtom) ||
		file?.name ||
		"Song audio";
	const path =
		globalStore.get(loadedAudioPathAtom) ||
		(file as (File & { path?: string }) | null)?.path ||
		null;

	const blob = globalStore.get(loadedAudioAtom);
	if (path) {
		try {
			await invoke("share_collab_media", { path, name, kind: "audio" });
			return;
		} catch (cause) {
			if (!blob.size) throw cause;
		}
	}

	if (!blob.size) {
		throw new Error("Load a song before sharing its audio.");
	}
	const { tempDir, join } = await import("@tauri-apps/api/path");
	const { writeFile } = await import("@tauri-apps/plugin-fs");
	const safeName = name.replace(/[^\w.-]+/g, "_").slice(-80) || "song-audio";
	const audioPath = await join(
		await tempDir(),
		`ttml-share-${Date.now()}-${safeName}`,
	);
	await writeFile(audioPath, new Uint8Array(await blob.arrayBuffer()));
	await invoke("share_collab_media", {
		path: audioPath,
		name,
		kind: "audio",
	});
}
