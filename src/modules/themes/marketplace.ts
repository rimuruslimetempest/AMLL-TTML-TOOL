import { THEME_REGISTRY_URL } from "$/config/links";
import { sanitizeThemeCss } from "./css";
import type { ThemePack, ThemePerformance } from "./types";
import { parseTheme } from "./validate";

export const COMMUNITY_THEMES_OPT_IN_KEY = "ttml_community_themes_opt_in_v1";
export const COMMUNITY_THEMES_NOTICE_KEY = "ttml_community_themes_notice_v1";

const MAX_REGISTRY_BYTES = 512 * 1024;
const MAX_THEME_BYTES = 2 * 1024 * 1024;

export interface CommunityThemeEntry {
	id: string;
	name: string;
	author: string;
	version: string;
	description: string;
	tags: string[];
	appearance: "dark" | "light";
	preview: string;
	download: string;
	sha256: string;
	size?: number;
	performance: ThemePerformance;
	minAppVersion: string;
	verified?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntry(value: unknown): CommunityThemeEntry | null {
	if (!isRecord(value)) return null;
	for (const field of [
		"id",
		"name",
		"author",
		"version",
		"description",
		"preview",
		"download",
		"sha256",
		"performance",
		"minAppVersion",
		"appearance",
	]) {
		if (typeof value[field] !== "string" || !value[field].trim()) return null;
	}
	if (
		value.appearance !== "dark" &&
		value.appearance !== "light"
	)
		return null;
	if (
		value.performance !== "light" &&
		value.performance !== "medium" &&
		value.performance !== "heavy"
	)
		return null;
	if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string"))
		return null;
	if (!/^[a-f0-9]{64}$/.test(String(value.sha256))) return null;
	return {
		id: String(value.id),
		name: String(value.name),
		author: String(value.author),
		version: String(value.version),
		description: String(value.description),
		tags: value.tags as string[],
		appearance: value.appearance,
		preview: String(value.preview),
		download: String(value.download),
		sha256: String(value.sha256),
		size: typeof value.size === "number" ? value.size : undefined,
		performance: value.performance,
		minAppVersion: String(value.minAppVersion),
		verified: value.verified === true,
	};
}

function resolveHttpsUrl(path: string, base = THEME_REGISTRY_URL): string {
	const url = new URL(path, base);
	if (url.protocol !== "https:") {
		throw new Error("The theme registry returned a non-HTTPS address.");
	}
	return url.href;
}

export function isCommunityThemesOptedIn(): boolean {
	try {
		return localStorage.getItem(COMMUNITY_THEMES_OPT_IN_KEY) === "true";
	} catch {
		return false;
	}
}

export function setCommunityThemesOptedIn(value: boolean): void {
	try {
		localStorage.setItem(COMMUNITY_THEMES_OPT_IN_KEY, String(value));
	} catch {
		// Ignore storage failures; the marketplace still works for this session.
	}
}

export function hasSeenCommunityThemesNotice(): boolean {
	try {
		return localStorage.getItem(COMMUNITY_THEMES_NOTICE_KEY) === "true";
	} catch {
		return false;
	}
}

export function markCommunityThemesNoticeSeen(): void {
	try {
		localStorage.setItem(COMMUNITY_THEMES_NOTICE_KEY, "true");
	} catch {
		// Ignore storage failures.
	}
}

export function communityThemePreviewUrl(entry: CommunityThemeEntry): string {
	return resolveHttpsUrl(entry.preview);
}

export async function fetchCommunityThemes(
	signal?: AbortSignal,
): Promise<CommunityThemeEntry[]> {
	const response = await fetch(THEME_REGISTRY_URL, {
		headers: { accept: "application/json" },
		cache: "no-store",
		signal: signal ?? AbortSignal.timeout(15_000),
	});
	if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
	const text = await response.text();
	if (text.length > MAX_REGISTRY_BYTES) {
		throw new Error("The theme registry is larger than expected.");
	}
	const parsed: unknown = JSON.parse(text);
	if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.themes)) {
		throw new Error("The theme registry has an unknown format.");
	}
	return parsed.themes
		.map(readEntry)
		.filter((entry): entry is CommunityThemeEntry => entry !== null);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export interface FetchedCommunityTheme {
	theme: ThemePack;
	css?: string;
}

/**
 * Downloads one registry theme, verifies the published SHA-256, rejects remote
 * CSS and returns a parsed theme. Nothing is installed here; the caller shows
 * the normal preview and confirmation first.
 */
export async function fetchCommunityTheme(
	entry: CommunityThemeEntry,
	signal?: AbortSignal,
): Promise<FetchedCommunityTheme> {
	const url = resolveHttpsUrl(entry.download);
	const response = await fetch(url, {
		headers: { accept: "application/json" },
		cache: "no-store",
		signal: signal ?? AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
	const buffer = await response.arrayBuffer();
	if (buffer.byteLength > MAX_THEME_BYTES) {
		throw new Error("The theme file is larger than the 2 MB limit.");
	}
	if (entry.size !== undefined && entry.size !== buffer.byteLength) {
		throw new Error(
			"The theme file size does not match the marketplace listing.",
		);
	}
	const actual = await sha256Hex(buffer);
	if (actual !== entry.sha256) {
		throw new Error(
			"The downloaded theme does not match its published SHA-256 hash. It was not installed.",
		);
	}
	const text = new TextDecoder().decode(buffer);
	const parsed = parseTheme(text, { allowBuiltinId: false });
	if (!parsed.ok || !parsed.theme) {
		throw new Error(parsed.errors.join(" "));
	}
	if (parsed.theme.id !== entry.id) {
		throw new Error("The theme id does not match the marketplace listing.");
	}
	const rawCss = parsed.theme.css;
	if (rawCss) {
		const sanitized = sanitizeThemeCss(rawCss);
		if (sanitized.blockedRemoteUrls || sanitized.blockedRemoteImports) {
			throw new Error(
				"This theme tries to load remote content, so it was not installed.",
			);
		}
		return {
			theme: { ...parsed.theme, css: sanitized.css },
			css: sanitized.css,
		};
	}
	return { theme: parsed.theme };
}
