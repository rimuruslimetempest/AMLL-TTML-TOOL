import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "@tauri-apps/api/window";
import { platform, version } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { UiLayer, uiLayerAtom } from "$/modules/settings/states";
import { sanitizeThemeCss, scopeNewUiCss } from "./css";
import { loadUserThemes } from "./storage";
import {
	activeThemeAtom,
	activeThemeSchemeAtom,
	effectsSuppressedAtom,
	themeAllowRemoteContentAtom,
	themeAutoReloadAtom,
	themeCatalogAtom,
	themeCssSafeModeAtom,
	themeCustomCssAtom,
	themeCustomCssEnabledAtom,
	themeIdAtom,
	themeNoticeAtom,
	themeReloadTokenAtom,
	themesReadyAtom,
	resetThemeSelectionAtom,
	userThemesAtom,
} from "./state";
import { tokenCss } from "./tokens";
import { DEFAULT_THEME_ID, type ThemeScheme } from "./types";

function useSystemContrast(): boolean {
	const [more, setMore] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-contrast: more)").matches,
	);
	useEffect(() => {
		const query = window.matchMedia("(prefers-contrast: more)");
		const update = () => setMore(query.matches);
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return more;
}

function useSystemReducedMotion(): boolean {
	const [reduce, setReduce] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduce(query.matches);
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return reduce;
}

function buildRuntimeCss(
	themeId: string,
	scheme: ThemeScheme,
	effectsOn: boolean,
	nativeEffectOn: boolean,
): string {
	const glassRadius = effectsOn
		? "\t--ttml-radius-md: 14px;\n\t--ttml-radius-lg: 18px;\n\t--ttml-radius-xl: 20px;"
		: "";
	return `
:root[data-ui-layer="new"][data-theme="${themeId}"][data-theme-scheme="${scheme.id}"] {
	color-scheme: ${scheme.appearance};
${tokenCss(scheme, { flat: !effectsOn })}
${glassRadius}
}

html[data-ui-layer="new"][data-theme="${themeId}"][data-theme-scheme="${scheme.id}"] body {
	background-color: var(--ttml-bg-base) !important;
}

html[data-ui-layer="new"][data-theme="${themeId}"][data-theme-scheme="${scheme.id}"] .radix-themes {
	--color-background: var(--ttml-bg-base) !important;
	--color-panel-solid: var(--ttml-bg-raised) !important;
	--color-panel-translucent: color-mix(in srgb, var(--ttml-bg-raised) 82%, transparent) !important;
	--gray-1: var(--ttml-bg-base) !important;
	--gray-2: var(--ttml-bg-raised) !important;
	--gray-3: var(--ttml-surface) !important;
	--gray-4: var(--ttml-surface-2) !important;
	--gray-5: var(--ttml-surface-3) !important;
	--gray-6: var(--ttml-surface-hover) !important;
	--gray-11: var(--ttml-text-secondary) !important;
	--gray-12: var(--ttml-text) !important;
	--accent-9: var(--ttml-accent) !important;
	--accent-10: var(--ttml-accent-hover) !important;
	--accent-11: var(--ttml-accent-hover) !important;
	--accent-contrast: var(--ttml-accent-contrast) !important;
	--accent-a3: var(--ttml-accent-subtle) !important;
	--focus-color: var(--ttml-accent) !important;
	--code-font-family: var(--ttml-font-mono);
}

html[data-ui-layer="new"][data-theme="${themeId}"][data-theme-scheme="${scheme.id}"] :is(
	.rt-Card,
	.rt-BaseCard,
	.rt-PopoverContent,
	.rt-DialogContent,
	.rt-AlertDialogContent,
	.rt-DropdownMenuContent,
	.rt-ContextMenuContent,
	.rt-SelectContent,
	[data-ui-chrome="audiobar"],
	[data-ui-chrome="bottombar"]
) {
	color: var(--ttml-text);
}

html[data-ui-layer="new"][data-theme="${themeId}"] .rt-Badge:not(.rt-variant-solid) {
	border-color: var(--ttml-border-strong);
}

${
	nativeEffectOn
		? `
html[data-ui-layer="new"][data-theme="${themeId}"] {
	background-color: transparent !important;
}
`
		: ""
}
`;
}

export function ThemeRuntime() {
	const uiLayer = useAtomValue(uiLayerAtom);
	const activeTheme = useAtomValue(activeThemeAtom);
	const scheme = useAtomValue(activeThemeSchemeAtom);
	const themeId = useAtomValue(themeIdAtom);
	const setUserThemes = useSetAtom(userThemesAtom);
	const setThemesReady = useSetAtom(themesReadyAtom);
	const themesReady = useAtomValue(themesReadyAtom);
	const setNotice = useSetAtom(themeNoticeAtom);
	const resetThemeSelection = useSetAtom(resetThemeSelectionAtom);
	const catalog = useAtomValue(themeCatalogAtom);
	const effectsSuppressed = useAtomValue(effectsSuppressedAtom);
	const allowRemote = useAtomValue(themeAllowRemoteContentAtom);
	const customCss = useAtomValue(themeCustomCssAtom);
	const customCssEnabled = useAtomValue(themeCustomCssEnabledAtom);
	const cssSafeMode = useAtomValue(themeCssSafeModeAtom);
	const autoReload = useAtomValue(themeAutoReloadAtom);
	const reloadToken = useAtomValue(themeReloadTokenAtom);
	const [nativeEffectOn, setNativeEffectOn] = useState(false);
	const systemContrast = useSystemContrast();
	const systemReducedMotion = useSystemReducedMotion();
	const themeKey = `${activeTheme.id}:${scheme.id}:${reloadToken}`;

	useEffect(() => {
		let cancelled = false;
		const load = () =>
			loadUserThemes()
				.then((themes) => {
					if (cancelled) return;
					setUserThemes(themes);
					setThemesReady(true);
				})
				.catch((error) => {
					if (cancelled) return;
					console.warn("Could not load user themes", error);
					setThemesReady(true);
				});
		void load();

		if (!isTauri() || !autoReload) {
			return () => {
				cancelled = true;
			};
		}
		const timer = window.setInterval(() => void load(), 2500);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [autoReload, setThemesReady, setUserThemes]);

	useEffect(() => {
		if (!themesReady) return;
		const exists = catalog.some((theme) => theme.id === themeId);
		if (!exists && themeId !== DEFAULT_THEME_ID) {
			const message = `The theme "${themeId}" is unavailable. Default is active instead.`;
			setNotice(message);
			toast.warn(message, { toastId: "ttml-theme-fallback" });
		} else {
			setNotice(null);
		}
	}, [catalog, setNotice, themeId, themesReady]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.ctrlKey &&
				event.shiftKey &&
				event.altKey &&
				event.key.toLowerCase() === "t"
			) {
				event.preventDefault();
				resetThemeSelection();
				toast.info("Theme reset to Default.", { toastId: "ttml-theme-reset" });
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [resetThemeSelection]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("resetTheme") === "1") {
			resetThemeSelection();
			params.delete("resetTheme");
			const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
			window.history.replaceState({}, "", next);
		}
	}, [resetThemeSelection]);

	const effectsOn =
		uiLayer === UiLayer.New &&
		!effectsSuppressed &&
		!systemReducedMotion &&
		(activeTheme.effects?.level ?? "none") !== "none";

	useEffect(() => {
		let cancelled = false;
		if (
			uiLayer !== UiLayer.New ||
			activeTheme.nativeEffect !== "mica" ||
			!isTauri() ||
			effectsSuppressed
		) {
			setNativeEffectOn(false);
			return;
		}

		const isWindows11 = (() => {
			try {
				if (platform() !== "windows") return false;
				const build = Number(version().match(/10\.0\.(\d+)/)?.[1] ?? 0);
				return build >= 22000;
			} catch {
				return false;
			}
		})();
		if (!isWindows11) {
			setNativeEffectOn(false);
			return;
		}

		// The Windows window is already created transparent with the Mica/tabbed
		// effects in tauri.windows.conf.json. Re-apply Mica here so selecting the
		// theme is deterministic, but never clear the configured effects: that
		// would change the existing Windows appearance for every other theme.
		getCurrentWindow()
			.setEffects({ effects: [Effect.Mica] })
			.then(() => {
				if (!cancelled) setNativeEffectOn(true);
			})
			.catch((error) => {
				console.warn("Mica is not available on this system", error);
				if (!cancelled) setNativeEffectOn(false);
			});
		return () => {
			cancelled = true;
			// Restore the effects declared in tauri.windows.conf.json instead of
			// leaving the Mica theme's effect behind for every other theme.
			getCurrentWindow()
				.setEffects({ effects: [Effect.Tabbed, Effect.Mica] })
				.catch(() => {});
		};
	}, [
		activeTheme.id,
		activeTheme.nativeEffect,
		effectsSuppressed,
		uiLayer,
	]);

	useLayoutEffect(() => {
		const root = document.documentElement;
		if (uiLayer !== UiLayer.New) {
			root.removeAttribute("data-theme");
			root.removeAttribute("data-theme-scheme");
			root.removeAttribute("data-theme-effects");
			root.removeAttribute("data-theme-light");
			root.removeAttribute("data-native-effect");
			root.removeAttribute("data-theme-css");
			return;
		}
		root.dataset.theme = activeTheme.id;
		root.dataset.themeScheme = scheme.id;
		root.dataset.themeEffects = effectsOn ? "on" : "off";
		root.dataset.themeLight = scheme.appearance === "light" ? "true" : "false";
		root.dataset.nativeEffect = nativeEffectOn ? "on" : "off";
		root.dataset.themeCss = cssSafeMode ? "off" : "on";
	}, [
		cssSafeMode,
		activeTheme.id,
		effectsOn,
		nativeEffectOn,
		scheme.appearance,
		scheme.id,
		uiLayer,
	]);

	const themeCss = useMemo(() => {
		if (uiLayer !== UiLayer.New || cssSafeMode) return "";
		const sanitized = sanitizeThemeCss(activeTheme.css ?? "", {
			allowRemote,
		});
		if (!sanitized.css.trim()) return "";
		return activeTheme.builtin
			? sanitized.css
			: scopeNewUiCss(sanitized.css);
	}, [activeTheme.builtin, activeTheme.css, allowRemote, cssSafeMode, uiLayer]);

	const customCssText = useMemo(() => {
		if (
			uiLayer !== UiLayer.New ||
			cssSafeMode ||
			!customCssEnabled ||
			!customCss.trim()
		)
			return "";
		const sanitized = sanitizeThemeCss(customCss, { allowRemote });
		if (!sanitized.css.trim()) return "";
		return scopeNewUiCss(sanitized.css);
	}, [allowRemote, cssSafeMode, customCss, customCssEnabled, uiLayer]);

	const runtimeCss = useMemo(() => {
		const base = buildRuntimeCss(
			activeTheme.id,
			scheme,
			effectsOn,
			nativeEffectOn,
		);
		const highContrastCss = systemContrast
			? `
:root[data-ui-layer="new"][data-theme="${activeTheme.id}"] {
	--ttml-border: color-mix(in srgb, var(--ttml-text) 42%, transparent);
	--ttml-border-strong: color-mix(in srgb, var(--ttml-text) 70%, transparent);
	--ttml-text: ${scheme.appearance === "dark" ? "#ffffff" : "#000000"};
	--ttml-text-secondary: var(--ttml-text);
}
`
			: "";
		return `${base}\n${highContrastCss}\n${themeCss}\n${customCssText}`;
	}, [
		activeTheme.id,
		customCssText,
		effectsOn,
		nativeEffectOn,
		scheme,
		systemContrast,
		themeCss,
	]);

	// The theme id and scheme are part of the selector. A missing file falls
	// back to Default through activeThemeAtom; this effect only clears stale
	// inline state when the interface is Classic.
	useEffect(() => {
		if (uiLayer === UiLayer.New) return;
		const root = document.documentElement;
		root.style.removeProperty("--ttml-accent");
	}, [uiLayer]);

	if (uiLayer !== UiLayer.New) return null;
	return (
		<>
			<style id="ttml-theme-runtime" key={themeKey}>
				{runtimeCss}
			</style>
		</>
	);
}
