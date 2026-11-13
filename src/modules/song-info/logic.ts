import type { SongInfo, SongInfoStatus } from "./types";
import {
	EMPTY_SONG_INFO,
	SONG_INFO_STATUSES,
	SONG_INFO_STATUS_LABEL,
} from "./types";
import type { TTMLMetadata, TTMLLyric } from "$/types/ttml";

export const TITLE_KEY = "musicName";
export const ARTIST_KEY = "artists";
export const SONGWRITER_KEY = "songwriter";
export const LANGUAGE_KEY = "language";
export const SPOTIFY_KEY = "spotifyId";

export function metadataValues(
	metadata: readonly TTMLMetadata[],
	key: string,
): string[] {
	const entry = metadata.find(
		(candidate) => candidate.key.toLowerCase() === key.toLowerCase(),
	);
	return entry ? entry.value.map((value) => value.trim()).filter(Boolean) : [];
}

export function metadataValue(
	metadata: readonly TTMLMetadata[],
	key: string,
): string {
	return metadataValues(metadata, key)[0] ?? "";
}

/** Replaces a metadata key without leaving duplicate entries behind. */
export function withMetadataValues(
	metadata: readonly TTMLMetadata[],
	key: string,
	values: readonly string[],
): TTMLMetadata[] {
	const cleaned = values.map((value) => value.trim()).filter(Boolean);
	const kept = metadata.filter(
		(entry) => entry.key.toLowerCase() !== key.toLowerCase(),
	);
	if (cleaned.length === 0) return kept;
	const existing = metadata.find(
		(entry) => entry.key.toLowerCase() === key.toLowerCase(),
	);
	return [...kept, { key: existing?.key ?? key, value: cleaned }];
}

export function normalizeSongInfo(value: unknown): SongInfo {
	if (!value || typeof value !== "object") return { ...EMPTY_SONG_INFO };
	const raw = value as Partial<SongInfo>;
	const status = SONG_INFO_STATUSES.includes(raw.status as SongInfoStatus)
		? (raw.status as SongInfoStatus)
		: "not-started";
	return {
		links: Array.isArray(raw.links)
			? raw.links
					.filter((link): link is string => typeof link === "string")
					.map((link) => link.trim())
					.filter(Boolean)
					.slice(0, 50)
			: [],
		versionNotes:
			typeof raw.versionNotes === "string" ? raw.versionNotes : "",
		versionTimed: typeof raw.versionTimed === "string" ? raw.versionTimed : "",
		notes: typeof raw.notes === "string" ? raw.notes : "",
		status,
		updatedAt:
			typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
				? raw.updatedAt
				: 0,
	};
}

export interface SongInfoView {
	title: string;
	artist: string;
	songwriters: string[];
	lyricLanguage: string;
	spotifyIds: string[];
	links: string[];
	versionNotes: string;
	versionTimed: string;
	notes: string;
	status: SongInfoStatus;
}

export function readSongInfo(lyric: TTMLLyric): SongInfoView {
	const info = normalizeSongInfo(lyric.songInfo);
	return {
		title: metadataValue(lyric.metadata, TITLE_KEY),
		artist: metadataValue(lyric.metadata, ARTIST_KEY),
		songwriters: metadataValues(lyric.metadata, SONGWRITER_KEY),
		lyricLanguage: metadataValue(lyric.metadata, LANGUAGE_KEY),
		spotifyIds: metadataValues(lyric.metadata, SPOTIFY_KEY),
		links: info.links,
		versionNotes: info.versionNotes,
		versionTimed: info.versionTimed,
		notes: info.notes,
		status: info.status,
	};
}

const SPOTIFY_TRACK = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/i;
const SPOTIFY_URI = /^spotify:track:([A-Za-z0-9]+)$/i;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function spotifyIdFromText(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const uri = trimmed.match(SPOTIFY_URI);
	if (uri) return uri[1];
	const url = trimmed.match(SPOTIFY_TRACK);
	if (url) return url[1];
	if (SPOTIFY_ID.test(trimmed)) return trimmed;
	return null;
}

export function parseLinkLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

/** Splits pasted links into Spotify ids and ordinary links, forgivingly. */
export function classifyLinks(text: string): {
	links: string[];
	spotifyIds: string[];
} {
	const links: string[] = [];
	const spotifyIds: string[] = [];
	for (const line of parseLinkLines(text)) {
		const spotify = spotifyIdFromText(line);
		if (spotify) spotifyIds.push(spotify);
		else links.push(line);
	}
	return {
		links: [...new Set(links)],
		spotifyIds: [...new Set(spotifyIds)],
	};
}

export function statusLabel(status: SongInfoStatus): string {
	return SONG_INFO_STATUS_LABEL[status] ?? "Not started";
}

/** Clean text for a submission message; never includes lyrics or audio. */
export function buildSongInfoText(lyric: TTMLLyric): string {
	const view = readSongInfo(lyric);
	const lines: string[] = [];
	const heading = [view.title, view.artist].filter(Boolean).join(" — ");
	if (heading) lines.push(heading);
	if (view.songwriters.length > 0) {
		lines.push(`Songwriters: ${view.songwriters.join(", ")}`);
	}
	if (view.links.length > 0) {
		lines.push(`Links: ${view.links.join(" ")}`);
	}
	if (view.spotifyIds.length > 0) {
		lines.push(
			`Spotify: ${view.spotifyIds
				.map((id) => `https://open.spotify.com/track/${id}`)
				.join(" ")}`,
		);
	}
	if (view.versionTimed.trim()) {
		lines.push(`Version timed: ${view.versionTimed.trim()}`);
	}
	if (view.versionNotes.trim()) {
		lines.push(`Version notes: ${view.versionNotes.trim()}`);
	}
	if (view.notes.trim()) lines.push(`Notes: ${view.notes.trim()}`);
	lines.push(`Status: ${statusLabel(view.status)}`);
	return lines.join("\n");
}

export interface SongInfoCommit {
	title: string;
	artist: string;
	songwriters: string[];
	lyricLanguage: string;
	links: string;
	spotifyIds: string;
	versionNotes: string;
	versionTimed: string;
	notes: string;
	status: SongInfoStatus;
}

/** Applies edits in one step so autosave and rooms see a single change. */
export function commitSongInfo(
	lyric: TTMLLyric,
	edit: SongInfoCommit,
): { metadata: TTMLMetadata[]; songInfo: SongInfo } {
	const classified = classifyLinks(edit.links);
	const typedSpotify = edit.spotifyIds
		.split(/[\s,;]+/)
		.map((value) => spotifyIdFromText(value) ?? value.trim())
		.filter(Boolean);
	const spotifyIds = [
		...new Set([...classified.spotifyIds, ...typedSpotify]),
	];

	let metadata = lyric.metadata;
	metadata = withMetadataValues(metadata, TITLE_KEY, [edit.title]);
	metadata = withMetadataValues(metadata, ARTIST_KEY, [edit.artist]);
	metadata = withMetadataValues(
		metadata,
		SONGWRITER_KEY,
		edit.songwriters,
	);
	metadata = withMetadataValues(metadata, LANGUAGE_KEY, [edit.lyricLanguage]);
	metadata = withMetadataValues(metadata, SPOTIFY_KEY, spotifyIds);

	return {
		metadata,
		songInfo: {
			links: classified.links,
			versionNotes: edit.versionNotes.trim(),
			versionTimed: edit.versionTimed.trim(),
			notes: edit.notes.trim(),
			status: edit.status,
			updatedAt: Date.now(),
		},
	};
}

export function songwritersFromText(text: string): string[] {
	return text
		.split(/[\n,;/，；、|]+/)
		.map((value) => value.trim())
		.filter(Boolean);
}
