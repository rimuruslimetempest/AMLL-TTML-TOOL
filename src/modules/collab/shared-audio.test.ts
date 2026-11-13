import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadMusic = vi.hoisted(() => vi.fn());

vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: { loadMusic },
}));

vi.mock("$/modules/audio/states", async () => {
	const { atom } = await import("jotai");
	return {
		loadedAudioFileNameAtom: atom<string | null>(null),
		loadedAudioPathAtom: atom<string | null>(null),
	};
});

import {
	loadedAudioFileNameAtom,
	loadedAudioPathAtom,
} from "$/modules/audio/states";
import { globalStore } from "$/states/store";
import { loadSharedAudio } from "./shared-audio";
import type { CollabSharedMedia } from "./types";

const song: CollabSharedMedia = {
	id: "song-1",
	name: "Song.mp3",
	kind: "audio",
	size: 3,
	addedBy: "Host",
	at: 1,
};

describe("shared room audio", () => {
	beforeEach(() => {
		loadMusic.mockReset();
		loadMusic.mockResolvedValue(undefined);
		globalStore.set(loadedAudioFileNameAtom, null);
		globalStore.set(loadedAudioPathAtom, "old.mp3");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches the host song as an in-memory Blob", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(new Uint8Array([1, 2, 3]), {
					status: 200,
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await loadSharedAudio(
			{ localUrl: "https://room.example/?collabRoom=abc123", roomId: "abc123" },
			song,
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://room.example/collab/media/song-1?room=abc123",
			{ cache: "no-store" },
		);
		const loaded = loadMusic.mock.calls[0][0] as File & {
			transient?: boolean;
		};
		expect(loaded).toBeInstanceOf(File);
		expect(loaded.name).toBe("Song.mp3");
		expect(loaded.transient).toBe(true);
		expect(globalStore.get(loadedAudioFileNameAtom)).toBe("Song.mp3");
		expect(globalStore.get(loadedAudioPathAtom)).toBeNull();
	});

	it("does not fetch recordings", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loadSharedAudio(
				{ localUrl: "https://room.example", roomId: "abc123" },
				{ ...song, kind: "recording" },
			),
		).rejects.toThrow("Only a shared song can be loaded");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(loadMusic).not.toHaveBeenCalled();
	});
});
