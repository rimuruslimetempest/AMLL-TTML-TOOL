import type {
	ThemeScheme,
	ThemeTokenKey,
	ThemeTokenValues,
} from "./types";

/** Public theme token -> existing New UI CSS variable. */
export const THEME_TOKEN_VARIABLES: Record<ThemeTokenKey, string> = {
	bgBase: "--ttml-bg-base",
	bgRaised: "--ttml-bg-raised",
	bgOverlay: "--ttml-bg-overlay",
	surface: "--ttml-surface",
	surface2: "--ttml-surface-2",
	surface3: "--ttml-surface-3",
	surfaceHover: "--ttml-surface-hover",
	border: "--ttml-border",
	borderStrong: "--ttml-border-strong",
	text: "--ttml-text",
	textSecondary: "--ttml-text-secondary",
	textMuted: "--ttml-text-muted",
	textDisabled: "--ttml-text-disabled",
	accent: "--ttml-accent",
	accentHover: "--ttml-accent-hover",
	accentActive: "--ttml-accent-active",
	accentSubtle: "--ttml-accent-subtle",
	accentContrast: "--ttml-accent-contrast",
	success: "--ttml-success",
	successSubtle: "--ttml-success-subtle",
	warning: "--ttml-warning",
	warningSubtle: "--ttml-warning-subtle",
	danger: "--ttml-danger",
	dangerSubtle: "--ttml-danger-subtle",
	info: "--ttml-info",
	infoSubtle: "--ttml-info-subtle",
	lyricPlaying: "--ttml-lyric-playing",
	lyricPlayingBg: "--ttml-lyric-playing-bg",
	lyricSelectedBg: "--ttml-lyric-selected-bg",
	lyricUnsynced: "--ttml-lyric-unsynced",
	lyricUnsyncedBg: "--ttml-lyric-unsynced-bg",
	lyricSynced: "--ttml-lyric-synced",
	lyricSyncedBg: "--ttml-lyric-synced-bg",
	lyricFlagged: "--ttml-lyric-flagged",
	lyricFlaggedBg: "--ttml-lyric-flagged-bg",
	lyricLocked: "--ttml-lyric-locked",
	lyricLockedBg: "--ttml-lyric-locked-bg",
	timestampBg: "--ttml-timestamp-bg",
	timestampText: "--ttml-timestamp-text",
	timestampBorder: "--ttml-timestamp-border",
};

export const THEME_TOKEN_KEYS = Object.keys(
	THEME_TOKEN_VARIABLES,
) as ThemeTokenKey[];

export function tokenCss(
	scheme: ThemeScheme,
	options: { flat?: boolean } = {},
): string {
	const values = {
		...scheme.tokens,
		...(options.flat ? scheme.flatTokens : undefined),
	};
	const declarations = THEME_TOKEN_KEYS.map(
		(key) =>
			`\t${THEME_TOKEN_VARIABLES[key]}: ${values[key] ?? scheme.tokens[key]};`,
	);
	return declarations.join("\n");
}

export function tokenRecordToCss(
	tokens: Partial<ThemeTokenValues>,
): string {
	return THEME_TOKEN_KEYS.filter((key) => tokens[key])
		.map((key) => `\t${THEME_TOKEN_VARIABLES[key]}: ${tokens[key]};`)
		.join("\n");
}

export function resolveScheme(
	theme: { schemes: ThemeScheme[] },
	schemeId: string,
	isDark: boolean,
): ThemeScheme {
	const explicit = theme.schemes.find((scheme) => scheme.id === schemeId);
	if (explicit) return explicit;
	const matching = theme.schemes.find(
		(scheme) => scheme.appearance === (isDark ? "dark" : "light"),
	);
	return matching ?? theme.schemes[0];
}

export function schemeIsDark(scheme: ThemeScheme): boolean {
	return scheme.appearance === "dark";
}

/** Relative luminance for contrast warnings; supports #rgb/#rrggbb only. */
export function colorLuminance(value: string): number | null {
	const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!match) return null;
	const hex =
		match[1].length === 3
			? match[1]
					.split("")
					.map((character) => character + character)
					.join("")
			: match[1];
	const channels = [0, 2, 4].map((index) =>
		Number.parseInt(hex.slice(index, index + 2), 16) / 255,
	);
	const linear = channels.map((channel) =>
		channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground: string, background: string): number | null {
	const fg = colorLuminance(foreground);
	const bg = colorLuminance(background);
	if (fg === null || bg === null) return null;
	const lighter = Math.max(fg, bg);
	const darker = Math.min(fg, bg);
	return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastWarning {
	foreground: ThemeTokenKey;
	background: ThemeTokenKey;
	ratio: number;
}

/** Non-blocking WCAG AA check for the important text pairs. */
export function getContrastWarnings(
	tokens: ThemeTokenValues,
): ContrastWarning[] {
	const pairs: Array<[ThemeTokenKey, ThemeTokenKey]> = [
		["text", "bgBase"],
		["text", "bgRaised"],
		["textSecondary", "bgBase"],
		["textMuted", "bgRaised"],
		["accentContrast", "accent"],
		["timestampText", "timestampBg"],
		["lyricPlaying", "bgBase"],
		["lyricUnsynced", "bgBase"],
		["lyricSynced", "bgBase"],
		["lyricFlagged", "bgBase"],
		["lyricLocked", "bgBase"],
	];
	return pairs.flatMap(([foreground, background]) => {
		const ratio = contrastRatio(tokens[foreground], tokens[background]);
		return ratio !== null && ratio < 4.5
			? [{ foreground, background, ratio }]
			: [];
	});
}
