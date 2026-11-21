export const AUDIO_FORMATS = ["mp3", "m4a", "flac", "wav", "opus"] as const;
export const VIDEO_FORMATS = ["mp4", "mkv"] as const;
export const COOKIE_BROWSERS = ["brave", "chrome", "edge", "firefox"] as const;
export type CookieBrowser = "none" | (typeof COOKIE_BROWSERS)[number];
export type DownloadFormat =
	| (typeof AUDIO_FORMATS)[number]
	| (typeof VIDEO_FORMATS)[number];

export type DownloadEvent =
	| { kind: "preparing" }
	| { kind: "downloading"; percent: number | null }
	| { kind: "processing" };

export type SearchResult = {
	url: string;
	title: string;
	channel: string | null;
	duration: number | null;
};

type MetadataEntry = { key?: string; value?: readonly string[] };

/** "Artist Song" from the lyric metadata, for the search field. */
export function metadataQuery(metadata: readonly MetadataEntry[]): string {
	const first = (keys: readonly string[]) =>
		metadata
			.find((entry) => keys.includes((entry?.key ?? "").toLowerCase()))
			?.value?.[0]?.trim() ?? "";
	return [
		first(["artists", "artist", "author"]),
		first(["musicname", "title", "trackname"]),
	]
		.filter(Boolean)
		.join(" ");
}

/**
 * The search text to show when the downloader opens: the open song's
 * "Artist Song", unless the user has typed their own query since the last
 * automatic fill.
 */
export function nextSearchQuery(
	current: string,
	lastAuto: string,
	songQuery: string,
): string {
	const untouched = current === "" || current === lastAuto;
	return untouched && songQuery ? songQuery : current;
}

export function formatDuration(seconds: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function validDownloadUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			value.length <= 8192 &&
			(url.protocol === "https:" || url.protocol === "http:") &&
			!!url.hostname &&
			!url.username &&
			!url.password
		);
	} catch {
		return false;
	}
}

export function downloadError(value: unknown): {
	code: string;
	detail: string;
} {
	if (value && typeof value === "object" && "code" in value) {
		return {
			code: String(value.code),
			detail: "detail" in value ? String(value.detail) : "",
		};
	}
	return { code: "failed", detail: String(value) };
}

export type DownloaderAction = "update" | "ffmpeg" | "settings" | "cookies" | "retry";

export interface DownloadErrorInfo {
	code: string;
	detail: string;
	title: string;
	message: string;
	action?: DownloaderAction;
}

function contains(haystack: string, needles: readonly string[]): boolean {
	return needles.some((needle) => haystack.includes(needle));
}

/**
 * Turns yt-dlp output into a short explanation and a next step.
 * The raw text is kept for the collapsible Details section.
 */
export function explainDownloadError(value: unknown): DownloadErrorInfo {
	const { code, detail } = downloadError(value);
	const text = detail.toLowerCase();
	const info = (title: string, message: string, action?: DownloaderAction) => ({
		code,
		detail,
		title,
		message,
		action,
	});

	if (code === "cancelled") {
		return info("Download cancelled", "No file was kept.");
	}
	if (code === "timeout") {
		return info(
			"The download took too long",
			"The connection may be slow or the site may be blocking it. Try again, or use a different link.",
			"retry",
		);
	}
	if (code === "busy") {
		return info("Another download is running", "Wait for it to finish or cancel it first.");
	}
	if (code === "invalidUrl") {
		return info("That link is not valid", "Use a full http:// or https:// link without a username or password in it.");
	}
	if (code === "invalidCookies") {
		return info("That cookies file could not be used", "Choose a cookies.txt file exported from your browser, or clear the custom path.", "cookies");
	}
	if (code === "ffmpegMissing") {
		return info(
			"FFmpeg is missing",
			"yt-dlp needs FFmpeg to convert or merge the audio. Download a verified copy, or point the app at your own FFmpeg.",
			"ffmpeg",
		);
	}
	if (code === "unavailable") {
		return info(
			"The downloader is not set up",
			"yt-dlp was not found. Open Audio sources in Settings to install or update it.",
			"update",
		);
	}
	if (code === "unverified") {
		return info("The update could not be verified", "The downloaded file did not match its published checksum, so it was not installed. Try again later.", "retry");
	}
	if (code === "unsupportedPlatform") {
		return info("This platform has no official build", "Install yt-dlp yourself and choose its path in Settings → Audio sources.", "settings");
	}
	if (contains(text, ["sign in to confirm", "not a bot", "confirm you're not a bot", "confirm you’re not a bot"])) {
		return info(
			"The site wants a signed-in session",
			"This is the site's bot check, not a broken link. Add a cookies file from your browser in Audio sources, or try another source.",
			"cookies",
		);
	}
	if (contains(text, ["http error 429", "too many requests", "rate limit", "ratelimit"])) {
		return info("The site is rate-limiting requests", "Wait a few minutes before trying again. Downloading many items quickly makes this more likely.", "retry");
	}
	if (contains(text, ["unable to extract", "nsig extraction failed", "signature extraction failed", "no suitable js runtime", "javascript runtime", "some formats may be missing"])) {
		return info(
			"yt-dlp may be out of date",
			"The site changed something that this yt-dlp version does not understand. Update yt-dlp, then try again.",
			"update",
		);
	}
	if (contains(text, ["private video", "members-only", "members only", "join this channel", "login required", "please log in"])) {
		return info("This item is private or members-only", "The uploader has not made it public. Use a cookies file from an account that can watch it, if you have permission.", "cookies");
	}
	if (contains(text, ["age-restricted", "age restricted", "confirm your age", "inappropriate for some users"])) {
		return info("This item is age-restricted", "The site requires a signed-in account. Add a cookies file from your browser, or choose another source.", "cookies");
	}
	if (contains(text, ["not available in your country", "geo restriction", "geo-restricted", "blocked in your country", "region"])) {
		return info("This item is not available in your region", "The site blocks it for your location. Try another source.");
	}
	if (contains(text, ["unsupported url", "no suitable extractor", "is not a valid url"])) {
		return info("This site is not supported", "yt-dlp does not support this link. Try a direct audio or video page from a supported site.");
	}
	if (contains(text, ["http error 403", "forbidden"])) {
		return info("The site refused the request", "This often means yt-dlp needs an update or a cookies file. Try one of those, then retry.", "update");
	}
	if (contains(text, ["getaddrinfo", "name or service not known", "failed to resolve", "connection refused", "network is unreachable", "timed out", "certificate"])) {
		return info("Could not reach the site", "Check your internet connection and try again.", "retry");
	}
	if (contains(text, ["no space left", "permission denied", "access is denied", "read-only file system"])) {
		return info("The download folder is not writable", "Choose another folder, or free some space, then try again.", "settings");
	}
	return info(
		"The download failed",
		"Open Details for the raw yt-dlp output. Updating yt-dlp often fixes extraction errors.",
		"update",
	);
}

export function isPlaylistUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.searchParams.has("list") ||
			/\/playlist\b/i.test(url.pathname) ||
			/\/sets\//i.test(url.pathname)
		);
	} catch {
		return false;
	}
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "";
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
