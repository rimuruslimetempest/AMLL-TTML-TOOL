import { sanitizeTokenValue } from "./css";
import { BUILTIN_THEME_IDS } from "./builtins";
import { THEME_TOKEN_KEYS } from "./tokens";
import {
	type ThemeEffects,
	type ThemeManifest,
	type ThemePack,
	type ThemeScheme,
	type ThemeTokenKey,
	type ThemeTokenValues,
	type ThemeValidationResult,
} from "./types";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/i;
const APPEARANCES = new Set(["dark", "light"]);
const EFFECT_LEVELS = new Set(["none", "light", "medium", "heavy"]);
const PERFORMANCE_LEVELS = new Set(["light", "medium", "heavy"]);
const NATIVE_EFFECTS = new Set(["none", "mica", "acrylic"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
	value: unknown,
	label: string,
	errors: string[],
	maxLength = 240,
): string {
	if (typeof value !== "string" || !value.trim()) {
		errors.push(`${label} is required.`);
		return "";
	}
	const trimmed = value.trim();
	if (trimmed.length > maxLength) {
		errors.push(`${label} is too long.`);
		return "";
	}
	if (/[<>]/.test(trimmed)) {
		errors.push(`${label} cannot contain HTML.`);
		return "";
	}
	return trimmed;
}

function parseEffects(value: unknown, errors: string[]): ThemeEffects {
	if (value === undefined) return { level: "none", performance: "light" };
	if (!isRecord(value)) {
		errors.push("effects must be an object.");
		return { level: "none", performance: "light" };
	}
	if (
		value.level !== undefined &&
		(typeof value.level !== "string" || !EFFECT_LEVELS.has(value.level))
	) {
		errors.push('effects.level must be "none", "light", "medium", or "heavy".');
	}
	if (
		value.performance !== undefined &&
		(typeof value.performance !== "string" ||
			!PERFORMANCE_LEVELS.has(value.performance))
	) {
		errors.push('effects.performance must be "light", "medium", or "heavy".');
	}
	if (value.gpu !== undefined && typeof value.gpu !== "boolean") {
		errors.push("effects.gpu must be true or false.");
	}
	const level =
		typeof value.level === "string" && EFFECT_LEVELS.has(value.level)
			? value.level
			: "none";
	const performance =
		typeof value.performance === "string" &&
		PERFORMANCE_LEVELS.has(value.performance)
			? value.performance
			: level === "heavy"
				? "heavy"
				: level === "medium"
					? "medium"
					: "light";
	return {
		level: level as ThemeEffects["level"],
		performance: performance as ThemeEffects["performance"],
		gpu: value.gpu === true,
	};
}

function parseTokens(
	value: unknown,
	label: string,
	errors: string[],
): ThemeTokenValues | null {
	if (!isRecord(value)) {
		errors.push(`${label} is required.`);
		return null;
	}
	const tokens = {} as ThemeTokenValues;
	for (const key of THEME_TOKEN_KEYS) {
		const raw = value[key];
		if (typeof raw !== "string") {
			errors.push(`${label}.${key} is required.`);
			continue;
		}
		const safe = sanitizeTokenValue(raw);
		if (!safe) {
			errors.push(`${label}.${key} is not a safe CSS color.`);
			continue;
		}
		tokens[key] = safe;
	}
	return tokens;
}

function parseFlatTokens(
	value: unknown,
	label: string,
	errors: string[],
): Partial<ThemeTokenValues> | undefined {
	if (value === undefined) return undefined;
	if (!isRecord(value)) {
		errors.push(`${label} must be an object.`);
		return undefined;
	}
	const tokens: Partial<ThemeTokenValues> = {};
	for (const [key, raw] of Object.entries(value)) {
		if (!THEME_TOKEN_KEYS.includes(key as ThemeTokenKey)) {
			errors.push(`${label}.${key} is not a known token.`);
			continue;
		}
		if (typeof raw !== "string") {
			errors.push(`${label}.${key} must be a string.`);
			continue;
		}
		const safe = sanitizeTokenValue(raw);
		if (!safe) {
			errors.push(`${label}.${key} is not a safe CSS color.`);
			continue;
		}
		tokens[key as ThemeTokenKey] = safe;
	}
	return tokens;
}

function parseSchemes(value: unknown, errors: string[]): ThemeScheme[] {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("schemes must contain at least one color scheme.");
		return [];
	}
	const schemes: ThemeScheme[] = [];
	const seen = new Set<string>();
	for (const [index, raw] of value.entries()) {
		const label = `schemes[${index}]`;
		if (!isRecord(raw)) {
			errors.push(`${label} must be an object.`);
			continue;
		}
		const id = readString(raw.id, `${label}.id`, errors, 64);
		if (id && !ID_PATTERN.test(id)) {
			errors.push(`${label}.id must use lowercase letters, numbers, and dashes.`);
		}
		if (id && seen.has(id)) {
			errors.push(`${label}.id is duplicated.`);
		}
		seen.add(id);
		const name = readString(raw.name, `${label}.name`, errors, 80);
		const appearance =
			typeof raw.appearance === "string" &&
			APPEARANCES.has(raw.appearance)
				? (raw.appearance as "dark" | "light")
				: null;
		if (!appearance) {
			errors.push(`${label}.appearance must be "dark" or "light".`);
		}
		const tokens = parseTokens(raw.tokens, `${label}.tokens`, errors);
		const flatTokens = parseFlatTokens(
			raw.flatTokens,
			`${label}.flatTokens`,
			errors,
		);
		if (id && name && appearance && tokens) {
			schemes.push({
				id,
				name,
				appearance,
				tokens,
				...(flatTokens ? { flatTokens } : {}),
			});
		}
	}
	return schemes;
}

/**
 * Parses and validates a theme. The result is safe to show before install;
 * it never executes theme content.
 */
export function parseTheme(
	input: unknown,
	options: { css?: string; allowBuiltinId?: boolean } = {},
): ThemeValidationResult {
	const errors: string[] = [];
	let raw: unknown = input;
	if (typeof input === "string") {
		try {
			raw = JSON.parse(input);
		} catch {
			return { ok: false, errors: ["The theme JSON could not be parsed."] };
		}
	}
	if (!isRecord(raw)) {
		return { ok: false, errors: ["The theme must be a JSON object."] };
	}

	const id = readString(raw.id, "id", errors, 64);
	if (id && !ID_PATTERN.test(id)) {
		errors.push("id must use lowercase letters, numbers, and dashes.");
	}
	if (id && !options.allowBuiltinId && BUILTIN_THEME_IDS.has(id)) {
		errors.push(`The id "${id}" belongs to a built-in theme.`);
	}
	const name = readString(raw.name, "name", errors, 80);
	const author = readString(raw.author, "author", errors, 120);
	const version = readString(raw.version, "version", errors, 40);
	if (version && !VERSION_PATTERN.test(version)) {
		errors.push("version must look like 1.0.0.");
	}
	const description = readString(raw.description, "description", errors, 600);
	const schemes = parseSchemes(raw.schemes, errors);
	const effects = parseEffects(raw.effects, errors);

	if (raw.format !== undefined && raw.format !== 1) {
		errors.push("format must be 1.");
	}
	if (raw.format === undefined) {
		errors.push("format must be 1.");
	}
	if (raw.minAppVersion !== undefined && typeof raw.minAppVersion !== "string") {
		errors.push("minAppVersion must be a string.");
	}
	if (
		typeof raw.minAppVersion === "string" &&
		raw.minAppVersion.trim() &&
		!VERSION_PATTERN.test(raw.minAppVersion.trim())
	) {
		errors.push("minAppVersion must look like 1.0.0.");
	}
	const nativeEffect =
		raw.nativeEffect === undefined
			? "none"
			: typeof raw.nativeEffect === "string" &&
				  NATIVE_EFFECTS.has(raw.nativeEffect)
				? (raw.nativeEffect as ThemeManifest["nativeEffect"])
				: null;
	if (nativeEffect === null) {
		errors.push('nativeEffect must be "none", "mica", or "acrylic".');
	}
	const css =
		typeof options.css === "string"
			? options.css
			: typeof raw.css === "string"
				? raw.css
				: undefined;
	if (css !== undefined && css.length > 500_000) {
		errors.push("theme.css is too large (limit 500 KB).");
	}

	if (errors.length > 0) return { ok: false, errors };

	const theme: ThemePack = {
		format: 1,
		id,
		name,
		author,
		version,
		description,
		schemes,
		minAppVersion:
			typeof raw.minAppVersion === "string"
				? raw.minAppVersion.trim()
				: undefined,
		effects,
		nativeEffect: nativeEffect ?? "none",
		...(css !== undefined ? { css } : {}),
		builtin: false,
	};
	return { ok: true, errors: [], theme };
}

export function parseThemeFile(
	text: string,
	css?: string,
): ThemeValidationResult {
	return parseTheme(text, { css });
}

export function isThemeIdReserved(id: string): boolean {
	return BUILTIN_THEME_IDS.has(id);
}

export function sanitizeThemeId(name: string): string {
	const base = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return base || "my-theme";
}
