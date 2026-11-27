import {
	detectPluginCapabilities,
	type PluginCapabilities,
} from "./capabilities";
import { getAllPlugins } from "./plugin-store";
import { assertToolTimingUnchanged, snapshotToolTiming } from "./timing-guard";
import type {
	IntegratedPlugin,
	PluginMetadata,
	PluginPermission,
	PluginSlot,
	ToolLines,
	WASMPlugin,
} from "./types";

export interface IPluginInstance {
	metadata: PluginMetadata;
	capabilities: PluginCapabilities;
	runImporter: (input: string) => Promise<string>;
	runExporter: (data: string) => Promise<string>;
	runTool: (lines: ToolLines) => Promise<ToolLines>;
}

interface WasmExports {
	allocate: (size: number) => number;
	deallocate?: (ptr: number, size: number) => void;
	run_importer?: (ptr: number, len: number) => number;
	run_exporter?: (ptr: number, len: number) => number;
	run_tool?: (ptr: number, len: number) => number;
	memory: WebAssembly.Memory;
}

class WASMPluginInstance implements IPluginInstance {
	readonly capabilities: PluginCapabilities;

	constructor(
		public metadata: WASMPlugin,
		private instance: WebAssembly.Instance,
	) {
		this.capabilities = detectPluginCapabilities(
			metadata.type,
			instance.exports as unknown as Record<string, unknown>,
		);
	}

	private get exports(): WasmExports {
		return this.instance.exports as unknown as WasmExports;
	}

	private copyStringToWasm(str: string): { ptr: number; len: number } {
		const bytes = new TextEncoder().encode(str);
		const len = bytes.length;
		const ptr = this.exports.allocate(len);
		if (len > 0 && !ptr) {
			throw new Error("The plugin could not allocate memory for its input.");
		}
		new Uint8Array(this.exports.memory.buffer).set(bytes, ptr);
		return { ptr, len };
	}

	private readStringFromWasm(ptr: number): string {
		const memory = new Uint8Array(this.exports.memory.buffer);
		if (ptr <= 0 || ptr >= memory.length) {
			throw new Error("The plugin returned an invalid string pointer.");
		}
		let end = ptr;
		while (end < memory.length && memory[end] !== 0) end++;
		if (end === memory.length) {
			throw new Error("The plugin returned a string without a terminator.");
		}
		return new TextDecoder().decode(memory.slice(ptr, end));
	}

	async runImporter(input: string): Promise<string> {
		if (!this.capabilities.importer || !this.exports.run_importer) {
			throw new Error("This plugin does not provide an importer.");
		}
		const { ptr, len } = this.copyStringToWasm(input);
		const resPtr = this.exports.run_importer(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		return result;
	}

	async runExporter(data: string): Promise<string> {
		if (!this.capabilities.exporter || !this.exports.run_exporter) {
			throw new Error("This plugin does not provide an exporter.");
		}
		const { ptr, len } = this.copyStringToWasm(data);
		const resPtr = this.exports.run_exporter(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		return result;
	}

	async runTool(lines: ToolLines): Promise<ToolLines> {
		if (!this.capabilities.tool || !this.exports.run_tool) {
			throw new Error("This plugin does not provide a lyric tool.");
		}
		const { ptr, len } = this.copyStringToWasm(JSON.stringify(lines));
		const resPtr = this.exports.run_tool(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		try {
			return JSON.parse(result) as ToolLines;
		} catch {
			throw new Error("The plugin returned invalid JSON.");
		}
	}
}

class IntegratedPluginInstance implements IPluginInstance {
	readonly capabilities: PluginCapabilities;

	constructor(public metadata: IntegratedPlugin) {
		this.capabilities = detectPluginCapabilities(metadata.type, {
			run_importer: metadata.runImporter,
			run_exporter: metadata.runExporter,
			run_tool: metadata.runTool,
		});
	}

	async runImporter(input: string): Promise<string> {
		if (!this.metadata.runImporter) {
			throw new Error("This plugin does not provide an importer.");
		}
		return this.metadata.runImporter(input);
	}

	async runExporter(data: string): Promise<string> {
		if (!this.metadata.runExporter) {
			throw new Error("This plugin does not provide an exporter.");
		}
		return this.metadata.runExporter(data);
	}

	async runTool(lines: ToolLines): Promise<ToolLines> {
		if (!this.metadata.runTool) {
			throw new Error("This plugin does not provide a lyric tool.");
		}
		return this.metadata.runTool(lines);
	}
}

class PluginManager {
	private instances: Map<string, IPluginInstance> = new Map();

	async loadEnabledPlugins() {
		const plugins = await getAllPlugins();
		for (const plugin of plugins) {
			if (plugin.isEnabled && !plugin.isIntegrated) {
				await this.initializeWasmPlugin(plugin);
			}
		}
		if (typeof window !== "undefined") {
			window.dispatchEvent(new Event("ttml-plugins-changed"));
		}
	}

	unloadPlugin(pluginId: string) {
		this.instances.delete(pluginId);
	}

	registerIntegratedPlugin(plugin: IntegratedPlugin) {
		if (plugin.isEnabled) {
			this.instances.set(plugin.id, new IntegratedPluginInstance(plugin));
		}
	}

	private async initializeWasmPlugin(plugin: WASMPlugin) {
		try {
			const arrayBuffer = await plugin.blob.arrayBuffer();
			let wasmInstance: WebAssembly.Instance | null = null;
			const { instance } = await WebAssembly.instantiate(arrayBuffer, {
				env: {
					log: (ptr: number) => {
						if (!wasmInstance) return;
						try {
							const memory = new Uint8Array(
								(wasmInstance.exports.memory as WebAssembly.Memory).buffer,
							);
							let end = ptr;
							while (end < memory.length && memory[end] !== 0) end++;
							console.log(
								`[Plugin: ${plugin.name}]`,
								new TextDecoder().decode(memory.slice(ptr, end)),
							);
						} catch {
							// A broken log call must not stop the plugin from loading.
						}
					},
				},
			});
			wasmInstance = instance;
			this.instances.set(plugin.id, new WASMPluginInstance(plugin, instance));
		} catch (error) {
			console.error(`Failed to initialize WASM plugin ${plugin.name}:`, error);
		}
	}

	getImporters() {
		return Array.from(this.instances.values()).filter(
			(instance) => instance.capabilities.importer,
		);
	}

	getExporters() {
		return Array.from(this.instances.values()).filter(
			(instance) => instance.capabilities.exporter,
		);
	}

	private requirePermission(
		instance: IPluginInstance,
		permission: PluginPermission,
	) {
		const metadata = instance.metadata;
		// 1.0 plugins predate declared permissions and keep working.
		if ((metadata.apiVersion ?? 1) < 2) return;
		if (!metadata.permissions?.includes(permission)) {
			throw new Error(
				`Plugin “${metadata.name}” did not declare the ${permission} permission.`,
			);
		}
	}

	async runImporter(pluginId: string, input: string) {
		const instance = this.instances.get(pluginId);
		if (!instance?.capabilities.importer) {
			throw new Error("Plugin not found or does not provide an importer.");
		}
		this.requirePermission(instance, "lyrics:read");
		return instance.runImporter(input);
	}

	async runExporter(pluginId: string, data: string) {
		const instance = this.instances.get(pluginId);
		if (!instance?.capabilities.exporter) {
			throw new Error("Plugin not found or does not provide an exporter.");
		}
		this.requirePermission(instance, "lyrics:read");
		return instance.runExporter(data);
	}

	getPluginsBySlot(slot: PluginSlot): IPluginInstance[] {
		return Array.from(this.instances.values()).filter((instance) => {
			const metadata = instance.metadata;
			if ((metadata.apiVersion ?? 1) < 2) return false;
			if (!metadata.slots?.includes(slot)) return false;
			if (slot === "panel") return false; // Reserved until the host panel API exists.
			if (slot === "toolbar") {
				return (
					instance.capabilities.tool &&
					Boolean(metadata.permissions?.includes("ui:toolbar"))
				);
			}
			if (slot === "import-dialog") return instance.capabilities.importer;
			if (slot === "export-dialog") return instance.capabilities.exporter;
			return true;
		});
	}

	getAllInstances(): IPluginInstance[] {
		return Array.from(this.instances.values());
	}

	getTools() {
		return Array.from(this.instances.values()).filter(
			(instance) => instance.capabilities.tool,
		);
	}

	async runTool(pluginId: string, lines: ToolLines) {
		const instance = this.instances.get(pluginId);
		if (!instance?.capabilities.tool) {
			throw new Error("Plugin not found or does not provide a lyric tool.");
		}
		this.requirePermission(instance, "lyrics:read");
		this.requirePermission(instance, "lyrics:write");
		// Pass a clone so an in-process plugin cannot mutate the editor's state
		// before the host validates the result. Snapshot after cloning so the
		// structure matches exactly what the plugin receives.
		const input = JSON.parse(JSON.stringify(lines)) as ToolLines;
		const snapshot = snapshotToolTiming(input);
		const result = await instance.runTool(input);
		return assertToolTimingUnchanged(snapshot, result);
	}
}

export const pluginManager = new PluginManager();
