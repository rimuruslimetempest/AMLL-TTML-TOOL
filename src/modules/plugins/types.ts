import type { TTMLLyric } from "$/types/ttml";

export type ToolLines = TTMLLyric["lyricLines"];

export type PluginType = "importer" | "exporter" | "tool" | "both";

export const PLUGIN_API_VERSION = 2;

export type PluginPermission =
	| "lyrics:read"
	| "lyrics:write"
	| "files:read"
	| "files:write"
	| "network"
	| "settings:read"
	| "ui:toolbar"
	| "ui:panel";

export type PluginSlot = "toolbar" | "panel" | "import-dialog" | "export-dialog";

export interface PluginMetadata {
	id: string;
	name: string;
	description: string;
	author: string;
	version: string;
	type: PluginType;
	isEnabled: boolean;
	createdAt: number;
	isIntegrated?: boolean;
	techniques?: string[];
	usage?: string;
	/** Missing means a legacy 1.0 plugin without declared permissions. */
	apiVersion?: number;
	permissions?: PluginPermission[];
	slots?: PluginSlot[];
	homepage?: string;
}

export interface WASMPlugin extends PluginMetadata {
	blob: Blob; // The actual .wasm file
	sha256?: string; // Optional hash for integrity verification
}

export interface PluginRegistryEntry
	extends Omit<PluginMetadata, "isEnabled" | "createdAt" | "blob"> {
	downloadUrl: string;
	sha256: string;
	size?: number;
	tags?: string[];
	minAppVersion?: string;
	addedAt?: string;
	verified?: boolean;
	changelog?: string;
	deprecated?: boolean;
}

export interface IntegratedPlugin extends PluginMetadata {
	isIntegrated: true;
	runImporter?: (input: string) => Promise<string>;
	runExporter?: (data: string) => Promise<string>;
	runTool?: (lines: ToolLines) => Promise<ToolLines>;
}
