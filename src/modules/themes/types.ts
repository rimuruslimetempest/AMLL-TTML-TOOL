/**
 * TTML Tool theme format.
 *
 * A theme is CSS and JSON only. It never contains executable JavaScript.
 * The token names below are the public format users and theme authors edit;
 * they are intentionally mapped to the existing --ttml-* design tokens.
 */

export type ThemeAppearance = "dark" | "light";
export type ThemeEffectLevel = "none" | "light" | "medium" | "heavy";
export type ThemePerformance = "light" | "medium" | "heavy";
export type ThemeNativeEffect = "none" | "mica" | "acrylic";

export interface ThemeTokenValues {
	bgBase: string;
	bgRaised: string;
	bgOverlay: string;
	surface: string;
	surface2: string;
	surface3: string;
	surfaceHover: string;
	border: string;
	borderStrong: string;
	text: string;
	textSecondary: string;
	textMuted: string;
	textDisabled: string;
	accent: string;
	accentHover: string;
	accentActive: string;
	accentSubtle: string;
	accentContrast: string;
	success: string;
	successSubtle: string;
	warning: string;
	warningSubtle: string;
	danger: string;
	dangerSubtle: string;
	info: string;
	infoSubtle: string;
	lyricPlaying: string;
	lyricPlayingBg: string;
	lyricSelectedBg: string;
	lyricUnsynced: string;
	lyricUnsyncedBg: string;
	lyricSynced: string;
	lyricSyncedBg: string;
	lyricFlagged: string;
	lyricFlaggedBg: string;
	lyricLocked: string;
	lyricLockedBg: string;
	timestampBg: string;
	timestampText: string;
	timestampBorder: string;
}

export type ThemeTokenKey = keyof ThemeTokenValues;

export interface ThemeScheme {
	id: string;
	name: string;
	appearance: ThemeAppearance;
	/**
	 * Optional flat values used when effects are disabled. This lets a glass
	 * theme keep readable, opaque panels in Performance mode without changing
	 * the normal scheme.
	 */
	flatTokens?: Partial<ThemeTokenValues>;
	tokens: ThemeTokenValues;
}

export interface ThemeEffects {
	level: ThemeEffectLevel;
	gpu?: boolean;
	performance?: ThemePerformance;
}

export interface ThemeManifest {
	format: 1;
	id: string;
	name: string;
	author: string;
	version: string;
	description: string;
	schemes: ThemeScheme[];
	effects?: ThemeEffects;
	nativeEffect?: ThemeNativeEffect;
	minAppVersion?: string;
	/** Optional CSS for the "Copy as text" / single JSON form. */
	css?: string;
}

export interface ThemePack extends ThemeManifest {
	builtin: boolean;
	sourcePath?: string;
	css?: string;
}

export interface ThemeValidationResult {
	ok: boolean;
	errors: string[];
	theme?: ThemePack;
}

export interface ThemeCssResult {
	css: string;
	blockedRemoteUrls: boolean;
	blockedRemoteImports: boolean;
}

export const THEME_FORMAT_VERSION = 1;
export const THEME_FOLDER = "themes";
export const DEFAULT_THEME_ID = "default";
export const DEFAULT_SCHEME_ID = "auto";

export const THEME_TOKEN_GROUPS: ReadonlyArray<{
	title: string;
	keys: ReadonlyArray<ThemeTokenKey>;
}> = [
	{
		title: "Backgrounds",
		keys: ["bgBase", "bgRaised", "bgOverlay"],
	},
	{
		title: "Surfaces",
		keys: [
			"surface",
			"surface2",
			"surface3",
			"surfaceHover",
			"border",
			"borderStrong",
		],
	},
	{
		title: "Text",
		keys: ["text", "textSecondary", "textMuted", "textDisabled"],
	},
	{
		title: "Accent",
		keys: [
			"accent",
			"accentHover",
			"accentActive",
			"accentSubtle",
			"accentContrast",
		],
	},
	{
		title: "Status",
		keys: [
			"success",
			"successSubtle",
			"warning",
			"warningSubtle",
			"danger",
			"dangerSubtle",
			"info",
			"infoSubtle",
		],
	},
	{
		title: "Lyric states",
		keys: [
			"lyricPlaying",
			"lyricPlayingBg",
			"lyricSelectedBg",
			"lyricUnsynced",
			"lyricUnsyncedBg",
			"lyricSynced",
			"lyricSyncedBg",
			"lyricFlagged",
			"lyricFlaggedBg",
			"lyricLocked",
			"lyricLockedBg",
		],
	},
	{
		title: "Timestamp chips",
		keys: ["timestampBg", "timestampText", "timestampBorder"],
	},
];

export const THEME_TOKEN_LABELS: Record<ThemeTokenKey, string> = {
	bgBase: "App background",
	bgRaised: "Raised background",
	bgOverlay: "Overlay background",
	surface: "Surface",
	surface2: "Surface 2",
	surface3: "Surface 3",
	surfaceHover: "Surface hover",
	border: "Border",
	borderStrong: "Strong border",
	text: "Primary text",
	textSecondary: "Secondary text",
	textMuted: "Muted text",
	textDisabled: "Disabled text",
	accent: "Accent",
	accentHover: "Accent hover",
	accentActive: "Accent active",
	accentSubtle: "Accent subtle",
	accentContrast: "Accent contrast",
	success: "Success",
	successSubtle: "Success subtle",
	warning: "Warning",
	warningSubtle: "Warning subtle",
	danger: "Danger",
	dangerSubtle: "Danger subtle",
	info: "Info",
	infoSubtle: "Info subtle",
	lyricPlaying: "Playing lyric",
	lyricPlayingBg: "Playing lyric background",
	lyricSelectedBg: "Selected lyric background",
	lyricUnsynced: "Unsynced lyric",
	lyricUnsyncedBg: "Unsynced lyric background",
	lyricSynced: "Synced lyric",
	lyricSyncedBg: "Synced lyric background",
	lyricFlagged: "Flagged lyric",
	lyricFlaggedBg: "Flagged lyric background",
	lyricLocked: "Locked lyric",
	lyricLockedBg: "Locked lyric background",
	timestampBg: "Timestamp background",
	timestampText: "Timestamp text",
	timestampBorder: "Timestamp border",
};
