import type { PluginType } from "./types";

export interface PluginCapabilities {
	importer: boolean;
	exporter: boolean;
	tool: boolean;
}

type PluginExports = Record<string, unknown>;

/**
 * A plugin's metadata says what it is for; its exports say what it can
 * actually do. Both must agree before the host offers the plugin in a flow.
 */
export function detectPluginCapabilities(
	type: PluginType,
	exports: PluginExports,
): PluginCapabilities {
	const has = (name: string) => typeof exports[name] === "function";
	return {
		importer: (type === "importer" || type === "both") && has("run_importer"),
		exporter: (type === "exporter" || type === "both") && has("run_exporter"),
		tool: (type === "tool" || type === "both") && has("run_tool"),
	};
}
