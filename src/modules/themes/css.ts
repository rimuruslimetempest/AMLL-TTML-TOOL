import type { ThemeCssResult } from "./types";

const ANY_IMPORT = /@import\b[^;]*(?:;|$)/gi;
const CSS_URL = /url\s*\(\s*(['"]?)([^)]*?)\1\s*\)/gi;
const SCRIPT_LIKE =
	/<(?:script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi;
const UNSAFE_PROTOCOL = /(?:javascript|vbscript|data)\s*:/gi;

function isRemoteUrl(url: string): boolean {
	const trimmed = url.trim().replace(/^['"]|['"]$/g, "");
	return /^(?:https?:)?\/\//i.test(trimmed);
}

// convertFileSrc uses http://asset.localhost on Windows and asset://localhost
// on the other platforms. Those are local files, not remote requests.
function isLocalAssetUrl(url: string): boolean {
	const trimmed = url.trim().replace(/^['"]|['"]$/g, "");
	return (
		/^https?:\/\/asset\.localhost\//i.test(trimmed) ||
		/^(?:asset|tauri):\/\//i.test(trimmed)
	);
}

/**
 * Sanitizes a theme stylesheet before it is inserted into a <style> element.
 * It removes remote loads unless the user explicitly opted in, always removes
 * @import, and strips things that are not stylesheet declarations.
 */
export function sanitizeThemeCss(
	raw: string,
	options: { allowRemote?: boolean } = {},
): ThemeCssResult {
	let css = String(raw ?? "")
		.replace(/\0/g, "")
		.replace(/<\/style/gi, "<\\/style")
		.replace(SCRIPT_LIKE, "")
		.replace(UNSAFE_PROTOCOL, "")
		.replace(/expression\s*\(/gi, "")
		.replace(/behavior\s*:/gi, "")
		.replace(/-moz-binding\s*:/gi, "");

	const blockedRemoteImports = ANY_IMPORT.test(css);
	ANY_IMPORT.lastIndex = 0;
	css = css.replace(ANY_IMPORT, "");

	let blockedRemoteUrls = false;
	if (!options.allowRemote) {
		css = css.replace(CSS_URL, (match, _quote, rawUrl) => {
			const url = String(rawUrl ?? "").trim();
			if (!isRemoteUrl(url) || isLocalAssetUrl(url)) return match;
			blockedRemoteUrls = true;
			return 'url("")';
		});
	}

	return { css, blockedRemoteUrls, blockedRemoteImports };
}

export function sanitizeTokenValue(value: string): string | null {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return null;
	if (/[;{}<>@]/.test(trimmed)) return null;
	if (/(?:url|expression|javascript|vbscript)\s*\(/i.test(trimmed))
		return null;
	if (/(?:javascript|vbscript|data)\s*:/i.test(trimmed)) return null;
	if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
		if (!CSS.supports("color", trimmed)) return null;
	}
	return trimmed;
}

export function rewriteThemeAssetUrls(
	css: string,
	toAssetUrl: (relativePath: string) => string,
): string {
	return css.replace(
		/url\s*\(\s*(['"]?)(?!data:|blob:|https?:|\/\/|asset:)([^'")]+)\1\s*\)/gi,
		(_match, quote: string, relativePath: string) =>
			`url(${quote}${toAssetUrl(relativePath.trim())}${quote})`,
	);
}

/**
 * User CSS is scoped to the New interface. Built-in CSS is authored with
 * explicit selectors, but imported CSS can never leak into Classic.
 */
export function scopeNewUiCss(css: string): string {
	return `@scope (html[data-ui-layer="new"]) {\n${css}\n}`;
}

const GLOBAL_THEME_SELECTOR =
	/(^|[\s,>+~(])(?:\*|html|body|:root|h[1-6]|\.rt-Heading)(?=$|[\s,.#:[>+~)])/i;

/**
 * Returns selectors that target the app shell or headings instead of a
 * theme-owned surface. These are the rules that can paint over the Settings
 * dialog or the title bar; the Theme safety switch exists to disable them.
 */
export function findGlobalThemeSelectors(css: string): string[] {
	const found = new Set<string>();
	const withoutComments = String(css ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
	for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
		const selector = match[1]?.trim();
		if (!selector || selector.startsWith("@")) continue;
		for (const part of selector.split(",")) {
			const trimmed = part.trim();
			if (trimmed && GLOBAL_THEME_SELECTOR.test(trimmed)) {
				found.add(trimmed);
			}
		}
	}
	return [...found].slice(0, 20);
}

export function isLocalCssUrl(url: string): boolean {
	return !isRemoteUrl(url) || isLocalAssetUrl(url);
}
