import { describe, expect, it } from "vitest";
import type { ProjectIdentity } from "$/modules/project/logic/project-info";
import type { TTMLLyric } from "$/types/ttml";
import {
	buildTtmlFileName,
	buildUploaderDefaults,
	extractSpotifyIds,
	formatLanguageLabel,
	formatPostText,
	getSongLinksFromMetadata,
	getSpotifyIdsFromMetadata,
	normalizeSpotifyIds,
} from "./logic";

const identity: ProjectIdentity = {
	name: "ON MY WAY!",
	artist: "asteria, kets4eki, 6arelyhuman",
	displayName: "ON MY WAY! - asteria, kets4eki, 6arelyhuman",
	isUntitled: false,
};

const lyric: TTMLLyric = {
	metadata: [
		{ key: "musicName", value: ["ON MY WAY!"] },
		{
			key: "artists",
			value: ["asteria, kets4eki, 6arelyhuman"],
		},
		{ key: "language", value: ["en"] },
		{ key: "spotifyId", value: ["4KDzpPbSialeRILXzZPhiP"] },
		{ key: "appleMusicId", value: ["1234567890"] },
		{
			key: "coverArt",
			value: ["https://example.com/cover.jpg"],
		},
	],
	lyricLines: [],
};

describe("ttml uploader logic", () => {
	it("extracts, deduplicates, and normalizes Spotify IDs from links or text", () => {
		const text = [
			"https://open.spotify.com/track/4KDzpPbSialeRILXzZPhiP?si=abc",
			"spotify:track:3cDQ3nWTLdKP5JtHje7fC",
			"4KDzpPbSialeRILXzZPhiP",
		].join("\n");

		expect(extractSpotifyIds(text)).toEqual([
			"4KDzpPbSialeRILXzZPhiP",
			"3cDQ3nWTLdKP5JtHje7fC",
		]);
		expect(normalizeSpotifyIds(text)).toBe(
			"4KDzpPbSialeRILXzZPhiP,3cDQ3nWTLdKP5JtHje7fC",
		);
	});

	it("builds the Discord message in the requested shape", () => {
		expect(
			formatPostText({
				title: "ignored here",
				language: "English",
				songLinks: "https://open.spotify.com/track/4KDzpPbSialeRILXzZPhiP",
				spotifyIds: "4KDzpPbSialeRILXzZPhiP,3cDQ3nWTLdKP5JtHje7fC",
			}),
		).toBe(
			"Song link(s): https://open.spotify.com/track/4KDzpPbSialeRILXzZPhiP\nSong ID's: 4KDzpPbSialeRILXzZPhiP,3cDQ3nWTLdKP5JtHje7fC",
		);
	});

	it("derives a Spotify link when only IDs are present", () => {
		expect(
			formatPostText({
				title: "",
				language: "",
				songLinks: "",
				spotifyIds: "4KDzpPbSialeRILXzZPhiP",
			}),
		).toBe(
			"Song link(s): https://open.spotify.com/track/4KDzpPbSialeRILXzZPhiP\nSong ID's: 4KDzpPbSialeRILXzZPhiP",
		);
	});

	it("uses project metadata for defaults", () => {
		const defaults = buildUploaderDefaults(
			identity,
			lyric,
			"3cDQ3nWTLdKP5JtHje7fC",
		);
		expect(defaults.title).toBe(
			"asteria, kets4eki, 6arelyhuman - ON MY WAY!",
		);
		expect(defaults.language).toBe("English");
		expect(defaults.spotifyIds).toBe(
			"4KDzpPbSialeRILXzZPhiP,3cDQ3nWTLdKP5JtHje7fC",
		);
		expect(defaults.songLinks).toContain(
			"https://open.spotify.com/track/4KDzpPbSialeRILXzZPhiP",
		);
		expect(defaults.songLinks).toContain(
			"https://music.apple.com/song/1234567890",
		);
	});

	it("extracts Spotify IDs and streaming links separately", () => {
		expect(getSpotifyIdsFromMetadata(lyric)).toEqual([
			"4KDzpPbSialeRILXzZPhiP",
		]);
		expect(getSongLinksFromMetadata(lyric)).toHaveLength(2);
	});

	it("formats language labels and safe TTML filenames", () => {
		expect(formatLanguageLabel("en-US")).toBe("English");
		expect(formatLanguageLabel("ja")).toBe("Japanese");
		expect(buildTtmlFileName(identity, "A/B: C?")).toBe("A-B- C-.ttml");
	});
});
