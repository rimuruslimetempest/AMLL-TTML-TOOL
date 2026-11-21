import { describe, expect, it } from "vitest";
import {
	downloadError,
	explainDownloadError,
	formatDuration,
	formatBytes,
	isPlaylistUrl,
	metadataQuery,
	nextSearchQuery,
	validDownloadUrl,
} from "./model";

describe("downloader search helpers", () => {
	it("builds a query from artist and title", () => {
		expect(
			metadataQuery([
				{ key: "musicName", value: [" Song "] },
				{ key: "artists", value: ["Artist", "Feature"] },
			]),
		).toBe("Artist Song");
		expect(metadataQuery([{ key: "musicName", value: ["Song"] }])).toBe("Song");
		expect(metadataQuery([])).toBe("");
		expect(
			metadataQuery([
				{ key: "Title", value: ["Track"] },
				{ key: "artist", value: ["Singer"] },
			]),
		).toBe("Singer Track");
	});
	it("replaces an untouched search with the newly opened song", () => {
		expect(nextSearchQuery("", "", "Artist A")).toBe("Artist A");
		// Reopened after loading song B, query never edited.
		expect(nextSearchQuery("Artist A", "Artist A", "Artist B")).toBe(
			"Artist B",
		);
		// The user typed their own query: keep it.
		expect(nextSearchQuery("my search", "Artist A", "Artist B")).toBe(
			"my search",
		);
		// No metadata: keep whatever is there.
		expect(nextSearchQuery("Artist A", "Artist A", "")).toBe("Artist A");
	});
	it("formats durations", () => {
		expect(formatDuration(215)).toBe("3:35");
		expect(formatDuration(3725)).toBe("1:02:05");
		expect(formatDuration(null)).toBe("");
		expect(formatDuration(Number.NaN)).toBe("");
	});
});

describe("downloader URL validation", () => {
	it("accepts HTTP(S) links with query strings", () => {
		expect(validDownloadUrl("https://example.org/watch?v=a&list=b")).toBe(true);
		expect(validDownloadUrl("http://example.org/audio")).toBe(true);
	});
	it.each([
		"--exec=calc",
		"file:///C:/secret",
		"ftp://example.org/a",
		"https://user:pass@example.org",
		"not a URL",
		`https://example.org/${"a".repeat(8192)}`,
	])("rejects %s", (value) => {
		expect(validDownloadUrl(value)).toBe(false);
	});
	it("preserves structured errors and handles unexpected failures", () => {
		expect(downloadError({ code: "cancelled", detail: "" })).toEqual({
			code: "cancelled",
			detail: "",
		});
		expect(downloadError("IPC failed")).toEqual({
			code: "failed",
			detail: "IPC failed",
		});
	});
});

describe("downloader error explanations", () => {
	it("maps the setup and FFmpeg errors to their own next step", () => {
		expect(explainDownloadError({ code: "ffmpegMissing", detail: "" }).action).toBe(
			"ffmpeg",
		);
		expect(explainDownloadError({ code: "unavailable", detail: "" }).action).toBe(
			"update",
		);
	});
	it("recognises the common yt-dlp failures", () => {
		expect(
			explainDownloadError({
				code: "failed",
				detail: "ERROR: Sign in to confirm you're not a bot",
			}).action,
		).toBe("cookies");
		expect(
			explainDownloadError({
				code: "failed",
				detail: "WARNING: Unable to extract nsig; please report this issue",
			}).action,
		).toBe("update");
		expect(
			explainDownloadError({
				code: "failed",
				detail: "HTTP Error 429: Too Many Requests",
			}).action,
		).toBe("retry");
		expect(
			explainDownloadError({
				code: "failed",
				detail: "ERROR: Private video. Sign in if you've been granted access",
			}).action,
		).toBe("cookies");
	});
	it("always keeps the raw detail", () => {
		const result = explainDownloadError({
			code: "failed",
			detail: "something unexpected",
		});
		expect(result.detail).toBe("something unexpected");
		expect(result.title.length).toBeGreaterThan(0);
	});
});

describe("downloader URL helpers", () => {
	it("detects playlist links without rejecting normal videos", () => {
		expect(isPlaylistUrl("https://www.youtube.com/watch?v=a&list=PL123")).toBe(true);
		expect(isPlaylistUrl("https://www.youtube.com/playlist?list=PL123")).toBe(true);
		expect(isPlaylistUrl("https://www.youtube.com/watch?v=a")).toBe(false);
		expect(isPlaylistUrl("not a url")).toBe(false);
	});
	it("formats sizes for the update card", () => {
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(0)).toBe("");
	});
});
