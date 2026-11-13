import type { ProjectIdentity } from "$/modules/project/logic/project-info";
import type { TTMLLyric } from "$/types/ttml";

export const TTML_UPLOADS_CHANNEL_ID = "1372633004584992808";
export const TTML_UPLOADS_CHANNEL_NAME = "#ttml-uploads";
export const TTML_UPLOADS_CHANNEL_MENTION = `<#${TTML_UPLOADS_CHANNEL_ID}>`;
export const DISCORD_APP_URL = "https://discord.com/app";

const STORAGE_PREFIX = "amll-ttml-uploader";
const LEGACY_STORAGE_PREFIX = "amll-submission-checklist";
// Spotify IDs are normally 22 characters, but accept 21 so an existing
// hand-entered ID is never silently dropped from the post.
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{21,22}$/;

export interface TtmlUploaderDraft {
	title: string;
	language: string;
	songLinks: string;
	spotifyIds: string;
}

export interface LegacyUploaderInfo {
	songLinks: string;
	spotifyIds: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
	ar: "Arabic",
	cs: "Czech",
	da: "Danish",
	de: "German",
	el: "Greek",
	en: "English",
	es: "Spanish",
	fa: "Persian",
	fi: "Finnish",
	fr: "French",
	he: "Hebrew",
	hi: "Hindi",
	hu: "Hungarian",
	id: "Indonesian",
	it: "Italian",
	ja: "Japanese",
	ko: "Korean",
	ms: "Malay",
	nl: "Dutch",
	no: "Norwegian",
	pl: "Polish",
	pt: "Portuguese",
	ro: "Romanian",
	ru: "Russian",
	sk: "Slovak",
	sv: "Swedish",
	th: "Thai",
	tl: "Filipino",
	tr: "Turkish",
	uk: "Ukrainian",
	vi: "Vietnamese",
	zh: "Chinese",
};

function metadataValues(lyric: TTMLLyric, keys: string[]): string[] {
	const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
	return lyric.metadata
		.filter((item) => normalizedKeys.has(item.key.toLowerCase()))
		.flatMap((item) => item.value)
		.map((value) => value.trim())
		.filter(Boolean);
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

export function extractSpotifyIds(value: string): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const token of value.split(/[^A-Za-z0-9]+/)) {
		if (!SPOTIFY_ID_RE.test(token) || seen.has(token)) continue;
		seen.add(token);
		ids.push(token);
	}
	return ids;
}

export function normalizeSpotifyIds(value: string): string {
	return extractSpotifyIds(value).join(",");
}

export function getProjectLanguage(lyric: TTMLLyric): string {
	for (const key of ["language", "lyriclanguage", "lang"]) {
		const value = metadataValues(lyric, [key]).find((item) => item.length > 0);
		if (value) return value;
	}
	return "";
}

export function formatLanguageLabel(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	const base = trimmed.toLowerCase().split(/[-_]/)[0] ?? trimmed;
	return LANGUAGE_LABELS[base] ?? trimmed;
}

export function getDefaultTitle(identity: ProjectIdentity): string {
	if (identity.artist && identity.name) {
		return `${identity.artist} - ${identity.name}`;
	}
	return identity.name || identity.artist || "Untitled";
}

export function getCoverArtFromMetadata(lyric: TTMLLyric): string {
	return (
		metadataValues(lyric, [
			"coverArt",
			"cover_art",
			"cover",
			"artwork",
			"albumArt",
		])[0] ?? ""
	);
}

const STREAMING_ID_URLS: Record<string, (id: string) => string> = {
	ncmMusicId: (id) => `https://music.163.com/#/song?id=${id}`,
	qqMusicId: (id) => `https://y.qq.com/n/ryqq/songDetail/${id}`,
	spotifyId: (id) => `https://open.spotify.com/track/${id}`,
	appleMusicId: (id) => `https://music.apple.com/song/${id}`,
};

export function getSongLinksFromMetadata(lyric: TTMLLyric): string[] {
	const links: string[] = [];
	for (const item of lyric.metadata) {
		const key = item.key.toLowerCase();
		const values = item.value
			.flatMap((value) => value.split(/[\n,;]+/))
			.map((value) => value.trim())
			.filter(Boolean);

		if (
			key === "songlink" ||
			key === "songlinks" ||
			key === "url" ||
			key === "sourceurl"
		) {
			for (const value of values) {
				if (/^https?:\/\//i.test(value)) links.push(value);
			}
			continue;
		}

		const urlBuilder = Object.entries(STREAMING_ID_URLS).find(
			([sourceKey]) => sourceKey.toLowerCase() === key,
		)?.[1];
		if (!urlBuilder) continue;
		for (const value of values) {
			const id = value.split(/\s+/)[0];
			if (id) links.push(urlBuilder(id));
		}
	}
	return unique(links);
}

export function getSpotifyIdsFromMetadata(lyric: TTMLLyric): string[] {
	const values = metadataValues(lyric, ["spotifyId", "spotify_id", "spotify"]);
	return unique([
		...extractSpotifyIds(values.join("\n")),
		...extractSpotifyIds(
			metadataValues(lyric, [
				"songLink",
				"songLinks",
				"url",
				"sourceUrl",
			]).join("\n"),
		),
	]);
}

export function buildUploaderDefaults(
	identity: ProjectIdentity,
	lyric: TTMLLyric,
	extraSpotifyIds = "",
): TtmlUploaderDraft {
	const ids = unique([
		...getSpotifyIdsFromMetadata(lyric),
		...extractSpotifyIds(extraSpotifyIds),
	]);
	return {
		title: identity.isUntitled ? "" : getDefaultTitle(identity),
		language: formatLanguageLabel(getProjectLanguage(lyric)),
		songLinks: getSongLinksFromMetadata(lyric).join("\n"),
		spotifyIds: ids.join(","),
	};
}

export function getSongLinks(draft: TtmlUploaderDraft): string[] {
	const explicit = draft.songLinks
		.split(/\r?\n|,\s*(?=https?:\/\/)/)
		.map((link) => link.trim())
		.filter(Boolean);
	if (explicit.length > 0) return unique(explicit);
	return extractSpotifyIds(draft.spotifyIds).map(
		(id) => `https://open.spotify.com/track/${id}`,
	);
}

export function formatPostText(draft: TtmlUploaderDraft): string {
	const ids = unique([
		...extractSpotifyIds(draft.spotifyIds),
		...extractSpotifyIds(draft.songLinks),
	]);
	const links = getSongLinks(draft);
	const lines: string[] = [];
	if (links.length > 0) lines.push(`Song link(s): ${links.join(", ")}`);
	if (ids.length > 0) lines.push(`Song ID's: ${ids.join(",")}`);
	return lines.join("\n");
}

export function sanitizeFileName(value: string): string {
	return (
		value
			.replace(/[\\/:*?"<>|]/g, "-")
			.replace(/\s+/g, " ")
			.trim() || "lyrics"
	);
}

export function buildTtmlFileName(
	identity: ProjectIdentity,
	title: string,
): string {
	return `${sanitizeFileName(title.trim() || getDefaultTitle(identity))}.ttml`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function loadUploaderDraft(projectId: string): TtmlUploaderDraft | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(`${STORAGE_PREFIX}:${projectId}`);
		if (!raw) return null;
		const value = JSON.parse(raw) as Partial<TtmlUploaderDraft> | null;
		if (!value || typeof value !== "object") return null;
		return {
			title: typeof value.title === "string" ? value.title : "",
			language:
				typeof value.language === "string" ? value.language : "",
			songLinks:
				typeof value.songLinks === "string" ? value.songLinks : "",
			spotifyIds:
				typeof value.spotifyIds === "string" ? value.spotifyIds : "",
		};
	} catch {
		return null;
	}
}

export function saveUploaderDraft(
	projectId: string,
	draft: TtmlUploaderDraft,
): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(
			`${STORAGE_PREFIX}:${projectId}`,
			JSON.stringify(draft),
		);
	} catch {
		// A full localStorage should not prevent preparing an upload.
	}
}

/**
 * Preserve the links and IDs people already entered in the old Submission
 * Checklist when they first open the uploader.
 */
export function loadLegacyUploaderInfo(
	projectId: string,
): LegacyUploaderInfo | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${projectId}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as {
			info?: { songLinks?: unknown; spotifyIds?: unknown };
		} | null;
		const info = parsed?.info;
		if (!info) return null;
		return {
			songLinks:
				typeof info.songLinks === "string" ? info.songLinks : "",
			spotifyIds:
				typeof info.spotifyIds === "string" ? info.spotifyIds : "",
		};
	} catch {
		return null;
	}
}
