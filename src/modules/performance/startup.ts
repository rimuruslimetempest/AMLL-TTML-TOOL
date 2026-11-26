import { invoke } from "@tauri-apps/api/core";

export type PreviewStartupFlag = "unlimited-frame-rate";

/**
 * "Unlimited" cannot be applied by the running webview: WebView2 fixes its
 * browser arguments while the process is created. The Rust side records a
 * marker file in the app config folder. On the next launch, lib.rs builds the
 * main window from its config with those extra arguments, so the setting takes
 * effect only after a restart.
 */
export async function setPreviewStartupFlag(
	flag: PreviewStartupFlag,
	enabled: boolean,
): Promise<void> {
	if (!import.meta.env.TAURI_ENV_PLATFORM) return;
	await invoke("set_preview_startup_flag", { flag, enabled });
}
