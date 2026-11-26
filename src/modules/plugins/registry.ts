import { PLUGIN_REGISTRY_URL } from "$/config/links";
import type {
	PluginPermission,
	PluginRegistryEntry,
	PluginSlot,
	PluginType,
} from "./types";

export type { PluginRegistryEntry } from "./types";

const MAX_REGISTRY_BYTES = 512 * 1024;
const PLUGIN_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;

const ALLOWED_PERMISSIONS = new Set<PluginPermission>([
	"lyrics:read",
	"lyrics:write",
	"files:read",
	"files:write",
	"network",
	"settings:read",
	"ui:toolbar",
	"ui:panel",
]);

const ALLOWED_SLOTS = new Set<PluginSlot>([
	"toolbar",
	"panel",
	"import-dialog",
	"export-dialog",
]);

const ALLOWED_TYPES = new Set<PluginType>([
	"importer",
	"exporter",
	"tool",
	"both",
]);

/**
 * Built-in listings shipped with the app. The reviewed catalog lives in
 * docs/registry/plugins.json; this list only keeps the store usable offline.
 */
export const OFFICIAL_PLUGIN_REGISTRY: PluginRegistryEntry[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readList<T extends string>(
	value: unknown,
	allowed: Set<T>,
): T[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const items = value.filter(
		(item): item is T => typeof item === "string" && allowed.has(item as T),
	);
	return [...new Set(items)];
}

function readEntry(value: unknown): PluginRegistryEntry | null {
	if (!isRecord(value)) return null;
	const id = readString(value.id);
	const name = readString(value.name);
	const author = readString(value.author);
	const version = readString(value.version);
	const description = readString(value.description);
	const download = readString(value.download) ?? readString(value.downloadUrl);
	const sha256 = readString(value.sha256);
	const type = readString(value.type);
	if (
		!id ||
		!PLUGIN_ID.test(id) ||
		!name ||
		!author ||
		!version ||
		!description ||
		!download ||
		!sha256 ||
		!SHA256.test(sha256) ||
		!type ||
		!ALLOWED_TYPES.has(type as PluginType)
	) {
		return null;
	}
	return {
		id,
		name,
		author,
		version,
		description,
		type: type as PluginType,
		apiVersion: value.apiVersion === 2 ? 2 : undefined,
		permissions: readList(value.permissions, ALLOWED_PERMISSIONS),
		slots: readList(value.slots, ALLOWED_SLOTS),
		homepage: readString(value.homepage) ?? undefined,
		downloadUrl: download,
		sha256,
		size: typeof value.size === "number" ? value.size : undefined,
		tags: Array.isArray(value.tags)
			? value.tags.filter((tag): tag is string => typeof tag === "string")
			: undefined,
		minAppVersion: readString(value.minAppVersion) ?? undefined,
		addedAt: readString(value.addedAt) ?? undefined,
		verified: value.verified === true,
		changelog: readString(value.changelog) ?? undefined,
		deprecated: value.deprecated === true,
	};
}

/** Optional override for local testing; the production default is the Pages registry. */
export function pluginRegistryUrl(): string {
	const override = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env?.VITE_PLUGIN_REGISTRY_URL;
	return override?.trim() || PLUGIN_REGISTRY_URL;
}

/** Registry entries are relative to the marketplace root, not registry/. */
export function resolvePluginRegistryUrl(path: string): string {
	if (/^https?:/i.test(path)) {
		const url = new URL(path);
		if (url.protocol !== "https:") {
			throw new Error("The plugin registry returned a non-HTTPS address.");
		}
		return url.href;
	}
	const base = new URL(pluginRegistryUrl());
	base.pathname = base.pathname.replace(/registry\/[^/]*$/, "");
	return new URL(path, base).href;
}

export async function fetchRemoteRegistry(): Promise<PluginRegistryEntry[]> {
	try {
		const res = await fetch(pluginRegistryUrl(), {
			headers: { accept: "application/json" },
			cache: "no-store",
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`The marketplace returned HTTP ${res.status}.`);
		const text = await res.text();
		if (text.length > MAX_REGISTRY_BYTES) {
			throw new Error("The plugin registry is larger than expected.");
		}
		const parsed: unknown = JSON.parse(text);
		if (
			!isRecord(parsed) ||
			parsed.version !== 1 ||
			!Array.isArray(parsed.plugins)
		) {
			throw new Error("The plugin registry has an unknown format.");
		}
		return parsed.plugins
			.map(readEntry)
			.filter((entry): entry is PluginRegistryEntry => entry !== null)
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		console.error("Plugin registry fetch failed:", error);
		return OFFICIAL_PLUGIN_REGISTRY;
	}
}

export const getRegistryEntry = (id: string) =>
	OFFICIAL_PLUGIN_REGISTRY.find((entry) => entry.id === id);
