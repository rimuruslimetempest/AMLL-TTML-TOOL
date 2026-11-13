/**
 * Song details that live with the project.
 *
 * Title, artist, songwriters, Spotify ids and the lyric language are the real
 * TTML metadata. Everything here is project-only and is never written to an
 * exported TTML file.
 */

export const SONG_INFO_STATUSES = [
	"not-started",
	"syncing",
	"needs-review",
	"ready",
] as const;

export type SongInfoStatus = (typeof SONG_INFO_STATUSES)[number];

export interface SongInfo {
	/** Extra links copied into the panel, such as a reference video. */
	links: string[];
	/** Clean, explicit, edit, different offset, and so on. */
	versionNotes: string;
	/** The exact version that was timed. */
	versionTimed: string;
	notes: string;
	status: SongInfoStatus;
	updatedAt: number;
}

export const EMPTY_SONG_INFO: SongInfo = {
	links: [],
	versionNotes: "",
	versionTimed: "",
	notes: "",
	status: "not-started",
	updatedAt: 0,
};

export const SONG_INFO_STATUS_LABEL: Record<SongInfoStatus, string> = {
	"not-started": "Not started",
	syncing: "Syncing",
	"needs-review": "Needs review",
	ready: "Ready to submit",
};
