import { THEME_REGISTRY_URL } from "$/config/links";
import { sanitizeThemeCss } from "./css";
import type { ThemePack, ThemePerformance } from "./types";
import { parseTheme } from "./validate";

const MAX_REGISTRY_BYTES = 512 * 1024;
const MAX_THEME_BYTES = 2 * 1024 * 1024;
const THEME_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface ThemeRegistryEntry {
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
	addedAt?: string;
	changelog?: string;
}

export interface FetchedRegistryTheme {
	theme: ThemePack;
	css?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntry(value: unknown): ThemeRegistryEntry | null {
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
	if (!THEME_ID.test(String(value.id))) return null;
	if (value.appearance !== "dark" && value.appearance !== "light") return null;
	if (
		value.performance !== "light" &&
		value.performance !== "medium" &&
		value.performance !== "heavy"
	)
		return null;
	if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string"))
		return null;
	if (!SHA256.test(String(value.sha256))) return null;
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
		addedAt: typeof value.addedAt === "string" ? value.addedAt : undefined,
		changelog: typeof value.changelog === "string" ? value.changelog : undefined,
	};
}

/** Optional override for local testing; the production default is the Pages registry. */
export function themeRegistryUrl(): string {
	const override = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env?.VITE_THEME_REGISTRY_URL;
	return override?.trim() || THEME_REGISTRY_URL;
}

function resolveMarketplaceUrl(path: string): string {
	const url = new URL(path, themeRegistryUrl());
	// Registry entries are relative to the marketplace root, not to registry/.
	if (!/^https?:/i.test(path)) {
		const base = new URL(themeRegistryUrl());
		base.pathname = base.pathname.replace(/registry\/[^/]*$/, "");
		return new URL(path, base).href;
	}
	if (url.protocol !== "https:") {
		throw new Error("The theme registry returned a non-HTTPS address.");
	}
	return url.href;
}

export function communityThemePreviewUrl(entry: ThemeRegistryEntry): string {
	return resolveMarketplaceUrl(entry.preview);
}

export async function fetchThemeRegistry(
	signal?: AbortSignal,
): Promise<ThemeRegistryEntry[]> {
	const response = await fetch(themeRegistryUrl(), {
		headers: { accept: "application/json" },
		cache: "no-store",
		signal: signal ?? AbortSignal.timeout(15_000),
	});
	if (!response.ok) throw new Error(`The marketplace returned HTTP ${response.status}.`);
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
		.filter((entry): entry is ThemeRegistryEntry => entry !== null);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Downloads one registry theme, verifies its published SHA-256, rejects remote
 * CSS, and returns a parsed theme. Nothing is installed here; the caller shows
 * the normal preview and confirmation first.
 */
export async function fetchRegistryTheme(
	entry: ThemeRegistryEntry,
	signal?: AbortSignal,
): Promise<FetchedRegistryTheme> {
	const response = await fetch(resolveMarketplaceUrl(entry.download), {
		headers: { accept: "application/json" },
		cache: "no-store",
		signal: signal ?? AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw new Error(`The marketplace returned HTTP ${response.status}.`);
	const buffer = await response.arrayBuffer();
	if (buffer.byteLength > MAX_THEME_BYTES) {
		throw new Error("The theme file is larger than the 2 MB limit.");
	}
	if (entry.size !== undefined && entry.size !== buffer.byteLength) {
		throw new Error("The theme file size does not match the marketplace listing.");
	}
	const actual = await sha256Hex(buffer);
	if (actual !== entry.sha256) {
		throw new Error(
			"The downloaded theme does not match its published SHA-256 hash. It was not installed.",
		);
	}
	const parsed = parseTheme(new TextDecoder().decode(buffer), {
		allowBuiltinId: false,
	});
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

function parts(version: string): number[] {
	return version
		.split(/[-+]/)[0]
		.split(".")
		.map((part) => Number.parseInt(part, 10) || 0);
}

/** Returns 1 when a is newer than b, -1 when older, and 0 when equal. */
export function compareVersions(a: string, b: string): number {
	const left = parts(a);
	const right = parts(b);
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference > 0 ? 1 : -1;
	}
	return 0;
}

export function isUpdateAvailable(
	installedVersion: string | undefined,
	registryVersion: string,
): boolean {
	if (!installedVersion) return false;
	return compareVersions(registryVersion, installedVersion) > 0;
}
