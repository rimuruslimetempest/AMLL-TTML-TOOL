import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { performanceModeAtom } from "$/modules/settings/states";
import { isDarkThemeAtom } from "$/states/main";
import { BUILTIN_THEMES } from "./builtins";
import { resolveScheme } from "./tokens";
import {
	DEFAULT_SCHEME_ID,
	DEFAULT_THEME_ID,
	type ThemePack,
} from "./types";

export const themeIdAtom = atomWithStorage<string>(
	"ttmlThemeId",
	DEFAULT_THEME_ID,
	undefined,
	{ getOnInit: true },
);
export const themeSchemeIdAtom = atomWithStorage<string>(
	"ttmlThemeScheme",
	DEFAULT_SCHEME_ID,
	undefined,
	{ getOnInit: true },
);
export const themeReduceEffectsAtom = atomWithStorage<boolean>(
	"ttmlThemeReduceEffects",
	false,
);
export const themeAccentOverrideAtom = atomWithStorage<boolean>(
	"ttmlThemeAccentOverride",
	false,
);
export const themeAllowRemoteContentAtom = atomWithStorage<boolean>(
	"ttmlThemeAllowRemote",
	false,
);
export const themeAutoReloadAtom = atomWithStorage<boolean>(
	"ttmlThemeAutoReload",
	false,
);
export const themeCustomCssEnabledAtom = atomWithStorage<boolean>(
	"ttmlThemeCustomCssEnabled",
	false,
);
export const themeCustomCssAtom = atomWithStorage<string>(
	"ttmlThemeCustomCss",
	"",
);
export const themeLastGoodIdAtom = atomWithStorage<string>(
	"ttmlThemeLastGood",
	DEFAULT_THEME_ID,
);
export const themeNoticeAtom = atom<string | null>(null);
export const userThemesAtom = atom<ThemePack[]>([]);
export const themesReadyAtom = atom(false);
export const themeReloadTokenAtom = atom(0);

export const resetThemeSelectionAtom = atom(null, (_get, set) => {
	set(themeIdAtom, DEFAULT_THEME_ID);
	set(themeSchemeIdAtom, DEFAULT_SCHEME_ID);
	set(themeReduceEffectsAtom, false);
	set(themeAccentOverrideAtom, false);
	set(themeCustomCssEnabledAtom, false);
	set(themeNoticeAtom, null);
});

export const themeCatalogAtom = atom<ThemePack[]>((get) => {
	const userThemes = get(userThemesAtom);
	const builtinIds = new Set(BUILTIN_THEMES.map((theme) => theme.id));
	return [
		...BUILTIN_THEMES,
		...userThemes.filter((theme) => !builtinIds.has(theme.id)),
	];
});

export const activeThemeAtom = atom<ThemePack>((get) => {
	const catalog = get(themeCatalogAtom);
	const id = get(themeIdAtom);
	return (
		catalog.find((theme) => theme.id === id) ??
		catalog.find((theme) => theme.id === DEFAULT_THEME_ID) ??
		BUILTIN_THEMES[0]
	);
});

export const activeThemeSchemeAtom = atom((get) => {
	const theme = get(activeThemeAtom);
	const isDark = get(isDarkThemeAtom);
	return resolveScheme(theme, get(themeSchemeIdAtom), isDark);
});

export const effectsSuppressedAtom = atom((get) => {
	const performanceMode = get(performanceModeAtom);
	const reduceEffects = get(themeReduceEffectsAtom);
	if (performanceMode || reduceEffects) return true;
	if (typeof window !== "undefined") {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			return true;
		if (
			typeof CSS !== "undefined" &&
			typeof CSS.supports === "function" &&
			!CSS.supports("backdrop-filter", "blur(1px)")
		) {
			return true;
		}
	}
	return false;
});
