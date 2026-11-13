/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/bobjoerules/AMLL-TTML-TOOL/blob/main/LICENSE
 */

import * as AMLLLyric from "@applemusic-like-lyrics/lyric";
import { enableMapSet } from "immer";
import { Provider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-toastify/dist/ReactToastify.css";

import App from "./App.tsx";
import "./i18n/index.ts";
import "./index.css";
import "./styles/tokens.css";
import "./styles/new-theme.css";
import "./utils/pwa.tsx";
import { initFirebase } from "$/modules/cloud/firebase";
import { isMigrationPath } from "$/modules/domain-migration/config";
import { MigrationRouteApp } from "$/modules/domain-migration/MigrationRouteApp";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import { hasStoredFeatureConsent } from "$/modules/privacy/consent";
import { initializeStoredDiagnostics } from "$/modules/privacy/diagnostics";
import {
	contrastAtom,
	densityAtom,
	performanceModeAtom,
	uiLayerAtom,
} from "$/modules/settings/states";
import { globalStore } from "./states/store.ts";

const initialRoot = document.documentElement;
initialRoot.dataset.uiLayer = globalStore.get(uiLayerAtom);
initialRoot.dataset.density = globalStore.get(densityAtom);
initialRoot.dataset.contrast = globalStore.get(contrastAtom);
initialRoot.dataset.performanceMode = globalStore.get(performanceModeAtom)
	? "true"
	: "false";

async function startApp() {
	const rootEl = document.getElementById("root");

	if (!rootEl) {
		throw new Error("Could not find root element");
	}

	if (isMigrationPath(window.location.pathname)) {
		createRoot(rootEl).render(
			<StrictMode>
				<MigrationRouteApp />
			</StrictMode>,
		);
		return;
	}

	try {
		if (
			"wasm_start" in AMLLLyric &&
			typeof AMLLLyric.wasm_start === "function"
		) {
			(AMLLLyric.wasm_start as () => void)();
		}

		await pluginManager.loadEnabledPlugins();
		if (hasStoredFeatureConsent("cloud")) {
			initFirebase();
		}
	} catch (e) {
		console.error("Error during App initialization:", e);
	}

	enableMapSet();
	initializeStoredDiagnostics();

	try {
		createRoot(rootEl).render(
			<StrictMode>
				<Provider store={globalStore}>
					<App />
					{/* <DevTools position="bottom-right" /> */}
				</Provider>
			</StrictMode>,
		);
	} catch (e) {
		console.error("Fatal error rendering React root:", e);
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			try {
				const { getCurrentWindow } = await import("@tauri-apps/api/window");
				await getCurrentWindow().show();
			} catch {}
		}
	}
}

startApp().catch(async (e) => {
	console.error("Fatal error starting app:", e);
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		try {
			const { getCurrentWindow } = await import("@tauri-apps/api/window");
			await getCurrentWindow().show();
		} catch {}
	}
});
