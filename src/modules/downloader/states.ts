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
