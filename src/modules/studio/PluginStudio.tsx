import { Dialog } from "@radix-ui/themes";
import JSZip from "jszip";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { confirmDialogAtom, settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import {
	getAllPlugins,
	togglePlugin,
} from "$/modules/plugins/plugin-store";
import type { PluginPermission, WASMPlugin } from "$/modules/plugins/types";
import { pluginStudioOpenAtom } from "$/modules/studio/state";
import { saveFile } from "$/utils/fileSystem";
import styles from "./studio.module.css";

const PERMISSION_LABELS: Record<PluginPermission, string> = {
	"lyrics:read": "Read lyrics",
	"lyrics:write": "Replace lyrics",
	"files:read": "Read files",
	"files:write": "Write files",
	network: "Network access",
	"settings:read": "Read settings",
	"ui:toolbar": "Toolbar slot",
	"ui:panel": "Panel slot",
};

function DevKit() {
	const zip = new JSZip();
	zip.file(
		"README.md",
		`# TTML Tool Plugin API 2.0\n\nA plugin is a WebAssembly module plus a metadata manifest. It never runs JavaScript in the app.\n\n## Manifest\n\n\`\`\`json\n{\n  "id": "com.example.pretty-printer",\n  "name": "Pretty Printer",\n  "description": "Formats lyric lines",\n  "author": "Your name",\n  "version": "1.0.0",\n  "type": "tool",\n  "apiVersion": 2,\n  "permissions": ["lyrics:read", "lyrics:write", "ui:toolbar"],\n  "slots": ["toolbar"]\n}\n\`\`\`\n\n## Exports\n\n- \`allocate(size: i32) -> i32\`\n- \`deallocate(ptr: i32, size: i32)\` (optional)\n- \`run_importer(ptr: i32, len: i32) -> i32\` (NUL-terminated UTF-8 result)\n- \`run_exporter(ptr: i32, len: i32) -> i32\`\n- \`run_tool(ptr: i32, len: i32) -> i32\` where input and output are JSON arrays of lyric lines.\n\nText is UTF-8. Return a pointer to a NUL-terminated string in the module's linear memory.\n\n## Permissions\n\nAPI 2.0 plugins must declare every permission they use. The host enforces \`lyrics:read\` and \`lyrics:write\` for tools, and only shows toolbar slots when \`ui:toolbar\` is declared.\n\n## Slots\n\n\`toolbar\`, \`panel\`, \`import-dialog\`, \`export-dialog\`. Toolbar plugins appear beside the workspace tabs and run on the current project after confirmation.\n\n## Build\n\n\`\`\`sh\nclang --target=wasm32 -nostdlib -Wl,--no-entry -Wl,--export-all -O3 example.c -o plugin.wasm\n\`\`\`\n\nThen install the \`.wasm\` file from Plugins → Plugin Management.\n`,
	);
	zip.file(
		"plugin.json",
		JSON.stringify(
			{
				id: "com.example.pretty-printer",
				name: "Pretty Printer",
				description: "Example tool plugin",
				author: "Your name",
				version: "1.0.0",
				type: "tool",
				apiVersion: 2,
				permissions: ["lyrics:read", "lyrics:write", "ui:toolbar"],
				slots: ["toolbar"],
			},
			null,
			2,
		),
	);
	zip.file(
		"plugin-api.d.ts",
		`export type PluginPermission =\n  | "lyrics:read"\n  | "lyrics:write"\n  | "files:read"\n  | "files:write"\n  | "network"\n  | "settings:read"\n  | "ui:toolbar"\n  | "ui:panel";\n\nexport type PluginSlot = "toolbar" | "panel" | "import-dialog" | "export-dialog";\n\nexport interface PluginManifest {\n  id: string;\n  name: string;\n  description: string;\n  author: string;\n  version: string;\n  type: "importer" | "exporter" | "tool" | "both";\n  apiVersion: 2;\n  permissions: PluginPermission[];\n  slots?: PluginSlot[];\n  homepage?: string;\n}\n\nexport interface WasmExports {\n  memory: WebAssembly.Memory;\n  allocate(size: number): number;\n  deallocate?(ptr: number, size: number): void;\n  run_importer(ptr: number, len: number): number;\n  run_exporter(ptr: number, len: number): number;\n  run_tool(ptr: number, len: number): number;\n}\n`,
	);
	zip.file(
		"example.c",
		`// Minimal Plugin API 2.0 tool: returns the lyric lines unchanged.\n#include <stdint.h>\n#include <stdlib.h>\n#include <string.h>\n\nstatic char *result = 0;\n\n__attribute__((export_name("allocate")))\nvoid *plugin_alloc(int size) { return malloc((size_t)size); }\n\n__attribute__((export_name("deallocate")))\nvoid plugin_free(void *ptr, int size) { (void)size; free(ptr); }\n\nstatic int reply(const char *input, int len) {\n  free(result);\n  result = malloc((size_t)len + 1);\n  if (!result) return 0;\n  memcpy(result, input, (size_t)len);\n  result[len] = 0;\n  return (int)(intptr_t)result;\n}\n\n__attribute__((export_name("run_tool")))\nint run_tool(const char *ptr, int len) { return reply(ptr, len); }\n`,
	);
	return zip;
}

export function PluginStudioDialog() {
	const [open, setOpen] = useAtom(pluginStudioOpenAtom);
	const store = useStore();
	const lyric = useAtomValue(lyricLinesAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const [plugins, setPlugins] = useState<WASMPlugin[]>([]);
	const [busy, setBusy] = useState(false);

	const refresh = () => {
		void getAllPlugins()
			.then(setPlugins)
			.catch(() => setPlugins([]));
	};

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		getAllPlugins()
			.then((list) => {
				if (!cancelled) setPlugins(list);
			})
			.catch(() => {
				if (!cancelled) setPlugins([]);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	const toggle = async (plugin: WASMPlugin) => {
		await togglePlugin(plugin.id, !plugin.isEnabled);
		if (plugin.isEnabled) pluginManager.unloadPlugin(plugin.id);
		await pluginManager.loadEnabledPlugins();
		refresh();
		toast.success(
			`${plugin.name} ${plugin.isEnabled ? "disabled" : "enabled"}.`,
		);
	};

	const runTool = (plugin: WASMPlugin) => {
		if (!pluginManager.getTools().some((tool) => tool.metadata.id === plugin.id)) {
			toast.info("Enable the plugin first, then run it.");
			return;
		}
		store.set(confirmDialogAtom, {
			open: true,
			title: `Run “${plugin.name}”?`,
			description:
				"The plugin receives every lyric line as JSON and can replace the project's lines. A workspace tab snapshot is kept.",
			confirmText: "Run tool",
			onConfirm: () => {
				setBusy(true);
				void pluginManager
					.runTool(plugin.id, lyric.lyricLines)
					.then((nextLines) => {
						if (!Array.isArray(nextLines)) {
							toast.error("The plugin returned an invalid result.");
							return;
						}
						store.set(lyricLinesAtom, {
							...store.get(lyricLinesAtom),
							lyricLines: nextLines,
						});
						toast.success(`${plugin.name} finished.`);
					})
					.catch((error) =>
						toast.error(error instanceof Error ? error.message : String(error)),
					)
					.finally(() => setBusy(false));
			},
		});
	};

	const exportDevKit = async () => {
		const zip = DevKit();
		const blob = await zip.generateAsync({ type: "blob" });
		const saved = await saveFile(blob, {
			suggestedName: "ttml-plugin-dev-kit.zip",
			types: [
				{ description: "ZIP archive", accept: { "application/zip": [".zip"] } },
			],
		});
		if (saved) toast.success(`Developer kit saved as ${saved}.`);
	};

	if (!open) return null;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.studioDialog}>
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Plugin API 2.0</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							Stable WASM ABI, declared permissions, UI slots, and a local
							developer kit. Plugins remain sandboxed WebAssembly.
						</Dialog.Description>
					</div>
					<div className={styles.studioRow}>
						<button
							type="button"
							className={styles.studioSecondary}
							onClick={() => {
								setSettingsTab("dev");
								setSettingsOpen(true);
								setOpen(false);
							}}
						>
							Manage plugins
						</button>
						<button
							type="button"
							className={styles.studioPrimary}
							onClick={() => void exportDevKit()}
						>
							Download dev kit
						</button>
						<Dialog.Close>
							<button type="button" className={styles.studioSecondary}>
								Close
							</button>
						</Dialog.Close>
					</div>
				</div>

				<div className={styles.studioBody}>
					<div className={styles.studioCard} style={{ marginBlockEnd: 10 }}>
						<strong>Stable host contract</strong>
						<div className={styles.studioMuted}>
							API version 2 keeps the existing <code>allocate</code> /{" "}
							<code>run_importer</code> / <code>run_exporter</code> /{" "}
							<code>run_tool</code> ABI. New metadata is additive, so 1.0
							plugins keep working. Tools must declare <code>lyrics:read</code>{" "}
							and <code>lyrics:write</code>; toolbar slots require{" "}
							<code>ui:toolbar</code>.
						</div>
						<div className={styles.studioRow}>
							<span className={styles.studioBadge}>ABI 2</span>
							<span className={styles.studioBadge}>WASM only</span>
							<span className={styles.studioBadge}>No remote code</span>
							<span className={styles.studioBadge}>
								{pluginManager.getPluginsBySlot("toolbar").length} toolbar slot
								{pluginManager.getPluginsBySlot("toolbar").length === 1 ? "" : "s"}
							</span>
						</div>
					</div>

					{plugins.length === 0 ? (
						<div className={styles.reviewEmpty}>
															No plugins installed. Open Settings → Developer to install a{" "}
								<code>.wasm</code> plugin.
						</div>
					) : (
						<div className={styles.studioGrid}>
							{plugins.map((plugin) => (
								<div key={plugin.id} className={styles.studioCard}>
									<div className={styles.studioRow}>
										<strong style={{ flex: 1 }}>{plugin.name}</strong>
										<span className={styles.studioBadge}>
											v{plugin.version}
										</span>
										<span className={styles.studioBadge}>
											API {plugin.apiVersion ?? 1}
										</span>
									</div>
									<div className={styles.studioMuted}>
										{plugin.description || "No description."}
									</div>
									<div className={styles.studioMuted}>
										Type {plugin.type} · by {plugin.author}
									</div>
									<div className={styles.studioRow}>
										{plugin.permissions?.length ? (
											plugin.permissions.map((permission) => (
												<span key={permission} className={styles.studioBadge}>
													{PERMISSION_LABELS[permission] ?? permission}
												</span>
											))
										) : (
											<span className={styles.studioBadge}>
												Legacy plugin · no declared permissions
											</span>
										)}
									</div>
									{plugin.slots?.length ? (
										<div className={styles.studioMuted}>
											Slots: {plugin.slots.join(", ")}
										</div>
									) : null}
									<div className={styles.studioRow}>
										<label className={styles.exportCheck}>
											<input
												type="checkbox"
												checked={plugin.isEnabled}
												onChange={() => void toggle(plugin)}
											/>
											Enabled
										</label>
										{plugin.type === "tool" || plugin.type === "both" ? (
											<button
												type="button"
												className={styles.studioSecondary}
												disabled={busy || !plugin.isEnabled}
												onClick={() => runTool(plugin)}
											>
												Run tool
											</button>
										) : null}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}

/** Real toolbar UI slot: only API 2.0 tool plugins that declare ui:toolbar appear. */
export function PluginToolbarSlots() {
	const store = useStore();
	const lyric = useAtomValue(lyricLinesAtom);
	const [plugins, setPlugins] = useState<WASMPlugin[]>([]);
	const [running, setRunning] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = () => {
			getAllPlugins()
				.then((list) => {
					if (!cancelled) {
						setPlugins(
							list.filter(
								(plugin) =>
									plugin.isEnabled &&
									(plugin.apiVersion ?? 1) >= 2 &&
									plugin.slots?.includes("toolbar") &&
									plugin.permissions?.includes("ui:toolbar") &&
									(plugin.type === "tool" || plugin.type === "both"),
							),
						);
					}
				})
				.catch(() => setPlugins([]));
		};
		load();
		window.addEventListener("ttml-plugins-changed", load);
		return () => {
			cancelled = true;
			window.removeEventListener("ttml-plugins-changed", load);
		};
	}, []);

	if (plugins.length === 0) return null;

	const run = (plugin: WASMPlugin) => {
		store.set(confirmDialogAtom, {
			open: true,
			title: `Run “${plugin.name}” from the toolbar?`,
			description:
				"This plugin declared the toolbar slot and lyrics read/write permissions.",
			confirmText: "Run",
			onConfirm: () => {
				setRunning(plugin.id);
				void pluginManager
					.runTool(plugin.id, lyric.lyricLines)
					.then((nextLines) => {
						if (!Array.isArray(nextLines)) {
							toast.error("The plugin returned an invalid result.");
							return;
						}
						store.set(lyricLinesAtom, {
							...store.get(lyricLinesAtom),
							lyricLines: nextLines,
						});
						toast.success(`${plugin.name} finished.`);
					})
					.catch((error) =>
						toast.error(error instanceof Error ? error.message : String(error)),
					)
					.finally(() => setRunning(null));
			},
		});
	};

	return (
		<div className={styles.workspaceStudioMenu}>
			{plugins.map((plugin) => (
				<button
					key={plugin.id}
					type="button"
					className={styles.workspaceAction}
					onClick={() => run(plugin)}
					disabled={running === plugin.id}
					title={`${plugin.name} · plugin toolbar slot`}
				>
					{running === plugin.id ? "Running…" : plugin.name}
				</button>
			))}
		</div>
	);
}
