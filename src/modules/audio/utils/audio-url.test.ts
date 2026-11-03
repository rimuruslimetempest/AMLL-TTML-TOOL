import { describe, expect, it } from "vitest";
import { isSupportedAudioExtension, resolveAudioFileName } from "./audio-url";

describe("resolveAudioFileName", () => {
	it("keeps a supported filename from the URL and ignores the query", () => {
		expect(
			resolveAudioFileName(
				new URL("https://archive.org/download/x/Song%20Title.flac?raw=1"),
				null,
			),
		).toBe("Song Title.flac");
	});

	it("derives the extension from the content type when the URL has none", () => {
		expect(
			resolveAudioFileName(
				new URL("https://example.com/stream?id=5"),
				"audio/mpeg; charset=binary",
			),
		).toBe("stream.mp3");
		expect(
			resolveAudioFileName(new URL("https://example.com/"), "audio/ogg"),
		).toBe("audio.ogg");
	});

	it("falls back to the content type for an unsupported extension", () => {
		expect(
			resolveAudioFileName(
				new URL("https://example.com/download/track.php"),
				"audio/x-flac",
			),
		).toBe("track.flac");
	});

	it("rejects pages and other non-audio responses", () => {
		expect(
			resolveAudioFileName(
				new URL("https://example.com/watch?v=1"),
				"text/html; charset=utf-8",
			),
		).toBeNull();
		expect(
			resolveAudioFileName(new URL("https://example.com/file.zip"), null),
		).toBeNull();
	});
});

describe("isSupportedAudioExtension", () => {
	it("is case insensitive", () => {
		expect(isSupportedAudioExtension("MP3")).toBe(true);
		expect(isSupportedAudioExtension("FLAC")).toBe(true);
		expect(isSupportedAudioExtension("html")).toBe(false);
	});
});