import { describe, expect, it } from "vitest";
import {
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	activeLineLocks,
	applyCollabPatch,
	buildGuestSession,
	buildGuestWebSocketUrl,
	collabMediaUrl,
	diffCollabSnapshots,
	getCollabHealth,
	getCollabRoomFromLocation,
	latestSharedAudio,
	parseCollabInviteLink,
	sanitizeCollabName,
	shouldHoldRemoteEdits,
	toCollabSnapshot,
} from "./logic";
import type { CollabSharedMedia } from "./types";

function lyric(): TTMLLyric {
	const line = newLyricLine();
	line.id = "line-a";
	line.startTime = 1000;
	line.endTime = 2000;
	line.words = [
		{
			...newLyricWord(),
			id: "word-a",
			word: "hello",
			startTime: 1000,
			endTime: 2000,
		},
	];
	return {
		metadata: [{ key: "title", value: ["First"] }],
		lyricLines: [line],
		marks: [],
		sections: [],
	};
}

describe("collaboration logic", () => {
	it("summarizes connection health from real latency", () => {
		expect(getCollabHealth("connecting", null).label).toBe("Connecting");
		expect(getCollabHealth("connected", null).label).toBe("Connected");
		expect(getCollabHealth("connected", 50)).toMatchObject({
			label: "Good",
			tone: "green",
		});
		expect(getCollabHealth("connected", 300)).toMatchObject({
			label: "Fair",
			tone: "amber",
		});
		expect(getCollabHealth("connected", 900)).toMatchObject({
			label: "Slow",
			tone: "red",
		});
		expect(getCollabHealth("reconnecting", 50)).toMatchObject({
			label: "Reconnecting",
			tone: "amber",
		});
	});

	it("holds remote edits only for pause or active local editing", () => {
		const base = {
			paused: false,
			interacting: false,
			syncing: false,
			playing: false,
		};
		expect(shouldHoldRemoteEdits(base)).toBe(false);
		expect(shouldHoldRemoteEdits({ ...base, paused: true })).toBe(true);
		expect(shouldHoldRemoteEdits({ ...base, interacting: true })).toBe(true);
		expect(shouldHoldRemoteEdits({ ...base, syncing: true, playing: true })).toBe(
			true,
		);
		expect(shouldHoldRemoteEdits({ ...base, syncing: true })).toBe(false);
	});

	it("hides expired soft locks", () => {
		const locks = [
			{
				lineId: "line-a",
				clientId: "alex",
				name: "Alex",
				color: "#60a5fa",
				expiresAt: 2000,
			},
			{
				lineId: "line-b",
				clientId: "bob",
				name: "Bob",
				color: "#34d399",
				expiresAt: 1000,
			},
		];
		expect(activeLineLocks(locks, 1500).map((lock) => lock.name)).toEqual([
			"Alex",
		]);
		expect(activeLineLocks(locks, 2500)).toEqual([]);
	});

	it("builds a line-addressable snapshot", () => {
		const snapshot = toCollabSnapshot(lyric());
		expect(snapshot.order).toEqual(["line-a"]);
		expect(snapshot.lines[0].data.words[0].word).toBe("hello");
		expect(snapshot.project.metadata[0].value).toEqual(["First"]);
	});

	it("diffs only the edited line", () => {
		const before = toCollabSnapshot(lyric());
		const next = lyric();
		next.lyricLines[0].words[0].word = "changed";
		next.lyricLines[0].endTime = 2200;
		const patch = diffCollabSnapshots(before, toCollabSnapshot(next));
		expect(patch?.lines?.map((line) => line.id)).toEqual(["line-a"]);
		expect(patch?.order).toBeUndefined();
		expect(patch?.project).toBeUndefined();
	});

	it("applies remote line and project changes", () => {
		const current = lyric();
		const next = lyric();
		next.lyricLines[0].words[0].word = "remote";
		next.metadata = [{ key: "title", value: ["Remote"] }];
		const updated = applyCollabPatch(current, {
			lines: toCollabSnapshot(next).lines,
			project: toCollabSnapshot(next).project,
		});
		expect(updated.lyricLines[0].words[0].word).toBe("remote");
		expect(updated.metadata[0].value).toEqual(["Remote"]);
	});

	it("removes deleted lines and keeps missing lines reachable", () => {
		const current = lyric();
		const second = newLyricLine();
		second.id = "line-b";
		current.lyricLines.push(second);
		const updated = applyCollabPatch(current, {
			removed: ["line-a"],
			lines: [
				{
					id: "line-c",
					data: { ...newLyricLine(), id: "line-c", words: [] },
				},
			],
		});
		expect(updated.lyricLines.map((line) => line.id)).toEqual(["line-b", "line-c"]);
	});

	it("selects the newest shared song and ignores recordings", () => {
		const shared = (
			id: string,
			kind: CollabSharedMedia["kind"],
			at: number,
		): CollabSharedMedia => ({
			id,
			name: `${id}.mp3`,
			kind,
			size: 1,
			addedBy: "Host",
			at,
		});
		expect(latestSharedAudio([])).toBeNull();
		const olderSong = shared("older-song", "audio", 10);
		const recording = shared("recording", "recording", 30);
		const newerSong = shared("newer-song", "audio", 20);
		expect(
			latestSharedAudio([olderSong, recording, newerSong]),
		).toBe(newerSong);
	});

	it("builds browser join URLs and sanitizes names", () => {
		expect(
			buildGuestWebSocketUrl(
				{ protocol: "http:", host: "192.168.1.20:43117" },
				"abc123",
				"Alex Doe",
			),
		).toBe("ws://192.168.1.20:43117/collab/ws?room=abc123&name=Alex+Doe");
		expect(getCollabRoomFromLocation("?collabRoom=abc123")).toBe("abc123");
		expect(sanitizeCollabName("  Alex  ")).toBe("Alex");
		expect(sanitizeCollabName("")).toBe("Guest");
		const guest = buildGuestSession(
			{
				protocol: "https:",
				host: "words-here.trycloudflare.com",
				origin: "https://words-here.trycloudflare.com",
				hostname: "words-here.trycloudflare.com",
			},
			"abc123",
		);
		expect(guest.remote).toBe(true);
		expect(guest.wsUrl).toBe(
			"wss://words-here.trycloudflare.com/collab/ws?room=abc123",
		);
		expect(collabMediaUrl(guest, "media-1")).toBe(
			"https://words-here.trycloudflare.com/collab/media/media-1?room=abc123",
		);
	});

	it("parses app join links and rejects unsafe or incomplete links", () => {
		const parsed = parseCollabInviteLink(
			"https://words-here.trycloudflare.com/?collabRoom=abc123&invite=invite-code",
		);
		expect(parsed.room).toBe("abc123");
		expect(parsed.inviteCode).toBe("invite-code");
		expect(parsed.url.hostname).toBe("words-here.trycloudflare.com");

		const local = parseCollabInviteLink(
			"http://192.168.1.20:43117/?collabRoom=local-room",
		);
		expect(local.room).toBe("local-room");
		expect(local.inviteCode).toBeUndefined();

		expect(() => parseCollabInviteLink("javascript:alert(1)")).toThrow(
			/http/i,
		);
		expect(() => parseCollabInviteLink("https://example.com/")).toThrow(
			/room/i,
		);
	});
});
