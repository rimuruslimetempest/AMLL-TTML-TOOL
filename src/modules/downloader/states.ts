import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { CookieBrowser, DownloadFormat, SearchResult } from "./model";

export const downloaderOpenAtom = atom(false);
export const downloaderInitialQueryAtom = atom<string | null>(null);
export const downloaderInitialUrlAtom = atom<string | null>(null);
export const downloaderInitialTrackAtom = atom<SearchResult | null>(null);
export const downloaderInitialFormatAtom = atom<DownloadFormat | null>(null);
export const downloaderCookieBrowserAtom = atomWithStorage<CookieBrowser>(
	"downloaderCookieBrowser",
	"none",
);

/** Optional cookies.txt path. The file stays on this computer. */
export const downloaderCookiesFileAtom = atomWithStorage<string>(
	"downloaderCookiesFile",
	"",
);

/** Opt-in daily check of yt-dlp's official GitHub release. */
export const downloaderDailyUpdateCheckAtom = atomWithStorage<boolean>(
	"downloaderDailyUpdateCheck",
	false,
);

/** One-time notice about downloading only media you may use. */
export const downloaderLegalNoticeAtom = atomWithStorage<boolean>(
	"downloaderLegalNoticeSeen",
	false,
);

export interface DownloaderCacheEntry {
	path: string;
	title: string;
	format: DownloadFormat;
	at: number;
}

/** Recent successful downloads, so the same URL is not fetched twice. */
export const downloaderCacheAtom = atomWithStorage<
	Record<string, DownloaderCacheEntry>
>("downloaderCacheV1", {});
