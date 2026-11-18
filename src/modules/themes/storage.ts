import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	mkdir,
	readDir,
	readFile,
	readTextFile,
	remove,
	writeFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { rewriteThemeAssetUrls } from "./css";
import { THEME_FOLDER, type ThemePack } from "./types";
import { parseTheme } from "./validate";

const FALLBACK_KEY = "ttml_user_themes_v1";

export interface ThemeAssetFile {
	path: string;
	data: Uint8Array;
}

export interface LoadedThemeDirectory {
	theme?: ThemePack;
	css?: string;
	assets: ThemeAssetFile[];
	errors: string[];
}

function safeRelativePath(path: string): string | null {
	const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
	if (!normalized || normalized.split("/").includes("..")) return null;
	if (!/^[a-zA-Z0-9 ._()/-]+$/.test(normalized)) return null;
	return normalized;
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

async function assetBasePath(themeId: string): Promise<string> {
	const base = await appDataDir();
	return join(base, THEME_FOLDER, themeId);
}

async function rewriteCssForTheme(css: string, themeId: string): Promise<string> {
	if (!isTauri() || !css) return css;
	const base = await assetBasePath(themeId);
	return rewriteThemeAssetUrls(css, (relativePath) => {
		const safe = safeRelativePath(relativePath);
		if (!safe) return "";
		return convertFileSrc(`${base}/${safe}`);
	});
}

function manifestOnly(theme: ThemePack) {
	return {
		format: 1 as const,
		id: theme.id,
		name: theme.name,
		author: theme.author,
		version: theme.version,
		description: theme.description,
		schemes: theme.schemes,
		...(theme.effects ? { effects: theme.effects } : {}),
		...(theme.nativeEffect && theme.nativeEffect !== "none"
			? { nativeEffect: theme.nativeEffect }
			: {}),
		...(theme.minAppVersion
			? { minAppVersion: theme.minAppVersion }
			: {}),
	};
}

function readBrowserThemes(): ThemePack[] {
	try {
		const raw = localStorage.getItem(FALLBACK_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((item) => {
			const result = parseTheme(item, { allowBuiltinId: false });
			return result.ok && result.theme ? [result.theme] : [];
		});
	} catch {
		return [];
	}
}

function writeBrowserThemes(themes: ThemePack[]): void {
	localStorage.setItem(
		FALLBACK_KEY,
		JSON.stringify(
			themes.map((theme) => ({
				...manifestOnly(theme),
				...(theme.css ? { css: theme.css } : {}),
			})),
		),
	);
}

export async function ensureThemeFolder(): Promise<void> {
	if (!isTauri()) return;
	await mkdir(THEME_FOLDER, {
		baseDir: BaseDirectory.AppData,
		recursive: true,
	});
}

export async function loadUserThemes(): Promise<ThemePack[]> {
	if (!isTauri()) return readBrowserThemes();
	try {
		await ensureThemeFolder();
		const entries = await readDir(THEME_FOLDER, {
			baseDir: BaseDirectory.AppData,
		});
		const themes: ThemePack[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory) continue;
			const id = entry.name;
			const folder = `${THEME_FOLDER}/${id}`;
			try {
				const manifestPath = `${folder}/theme.json`;
				if (
					!(await exists(manifestPath, { baseDir: BaseDirectory.AppData }))
				) {
					continue;
				}
				const manifest = await readTextFile(manifestPath, {
					baseDir: BaseDirectory.AppData,
				});
				const cssPath = `${folder}/theme.css`;
				const css = (await exists(cssPath, { baseDir: BaseDirectory.AppData }))
					? await readTextFile(cssPath, { baseDir: BaseDirectory.AppData })
					: undefined;
				const parsed = parseTheme(manifest, { css, allowBuiltinId: false });
				if (!parsed.ok || !parsed.theme) {
					console.warn(`Skipping invalid theme in ${folder}`, parsed.errors);
					continue;
				}
				const rewritten = css
					? await rewriteCssForTheme(css, parsed.theme.id)
					: undefined;
				themes.push({
					...parsed.theme,
					...(rewritten ? { css: rewritten } : {}),
					sourcePath: folder,
				});
			} catch (error) {
				console.warn(`Could not load theme from ${folder}`, error);
			}
		}
		return themes.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		console.warn("Could not read the themes folder", error);
		return [];
	}
}

export async function installUserTheme(
	theme: ThemePack,
	css: string | undefined,
	assets: ThemeAssetFile[] = [],
): Promise<ThemePack> {
	const installed: ThemePack = {
		...theme,
		builtin: false,
		sourcePath: `${THEME_FOLDER}/${theme.id}`,
		...(css ? { css } : {}),
	};
	if (!isTauri()) {
		const existing = readBrowserThemes().filter(
			(item) => item.id !== theme.id,
		);
		writeBrowserThemes([...existing, installed]);
		return installed;
	}

	const folder = `${THEME_FOLDER}/${theme.id}`;
	await mkdir(folder, { baseDir: BaseDirectory.AppData, recursive: true });
	await writeTextFile(
		`${folder}/theme.json`,
		JSON.stringify(manifestOnly(theme), null, 2),
		{ baseDir: BaseDirectory.AppData },
	);
	if (css) {
		await writeTextFile(`${folder}/theme.css`, css, {
			baseDir: BaseDirectory.AppData,
		});
	} else {
		const cssPath = `${folder}/theme.css`;
		if (await exists(cssPath, { baseDir: BaseDirectory.AppData })) {
			await remove(cssPath, { baseDir: BaseDirectory.AppData });
		}
	}
	for (const asset of assets) {
		const safe = safeRelativePath(asset.path);
		if (!safe || safe === "theme.json" || safe === "theme.css") continue;
		const fullPath = `${folder}/${safe}`;
		const parent = safe.includes("/")
			? `${folder}/${safe.slice(0, safe.lastIndexOf("/"))}`
			: folder;
		await mkdir(parent, { baseDir: BaseDirectory.AppData, recursive: true });
		await writeFile(fullPath, asset.data, {
			baseDir: BaseDirectory.AppData,
		});
	}
	return installed;
}

export async function deleteUserTheme(themeId: string): Promise<void> {
	if (!isTauri()) {
		writeBrowserThemes(
			readBrowserThemes().filter((theme) => theme.id !== themeId),
		);
		return;
	}
	await remove(`${THEME_FOLDER}/${themeId}`, {
		baseDir: BaseDirectory.AppData,
		recursive: true,
	});
}

export function themeToJson(theme: ThemePack, includeCss = false): string {
	return JSON.stringify(
		{
			...manifestOnly(theme),
			...(includeCss && theme.css ? { css: theme.css } : {}),
		},
		null,
		2,
	);
}

function findThemeRoot(paths: string[]): string | null {
	const manifests = paths
		.filter(
			(path) =>
				path === "theme.json" || path.endsWith("/theme.json"),
		)
		.sort((a, b) => a.split("/").length - b.split("/").length);
	return manifests[0] ?? null;
}

/**
 * Reads a folder or zip bundle into memory for preview and confirmation.
 * This accepts a theme.json at the root or inside one top-level folder.
 */
export async function readThemeBundle(
	files: Array<{ path: string; data: Uint8Array }>,
): Promise<LoadedThemeDirectory> {
	const normalized = files
		.map((file) => ({
			path: file.path.replace(/\\/g, "/").replace(/^\.?\//, ""),
			data: file.data,
		}))
		.filter((file) => safeRelativePath(file.path));
	const rootManifest = findThemeRoot(normalized.map((file) => file.path));
	if (!rootManifest) {
		return { assets: [], errors: ["The bundle has no theme.json."] };
	}
	const root = rootManifest.slice(0, -"theme.json".length).replace(/\/$/, "");
	const byRelative = new Map(
		normalized.map((file) => [
			root ? file.path.slice(root.length + 1) : file.path,
			file,
		]),
	);
	const manifest = byRelative.get("theme.json");
	if (!manifest) {
		return { assets: [], errors: ["The bundle has no theme.json."] };
	}
	const cssFile = byRelative.get("theme.css");
	const result = parseTheme(decode(manifest.data), {
		css: cssFile ? decode(cssFile.data) : undefined,
	});
	if (!result.ok || !result.theme) return { assets: [], errors: result.errors };
	const assets = normalized
		.filter((file) => {
			const relative = root ? file.path.slice(root.length + 1) : file.path;
			return (
				relative &&
				relative !== "theme.json" &&
				relative !== "theme.css" &&
				!relative.startsWith("__MACOSX/")
			);
		})
		.map((file) => ({
			path: root ? file.path.slice(root.length + 1) : file.path,
			data: file.data,
		}));
	return {
		theme: result.theme,
		css: cssFile ? decode(cssFile.data) : result.theme.css,
		assets,
		errors: [],
	};
}

export async function readThemeFolder(
	directoryPath: string,
): Promise<LoadedThemeDirectory> {
	if (!isTauri()) {
		return { assets: [], errors: ["Folder import is desktop-only."] };
	}
	const collected: Array<{ path: string; data: Uint8Array }> = [];
	let total = 0;
	const walk = async (path: string, prefix: string, depth: number) => {
		if (depth > 2) return;
		const entries = await readDir(path);
		for (const entry of entries) {
			if (entry.isDirectory) {
				if (entry.name === "__MACOSX") continue;
				await walk(`${path}/${entry.name}`, `${prefix}${entry.name}/`, depth + 1);
				continue;
			}
			if (!entry.isFile) continue;
			const data = await readFile(`${path}/${entry.name}`);
			total += data.byteLength;
			if (total > 12 * 1024 * 1024) {
				throw new Error("The theme folder is larger than 12 MB.");
			}
			collected.push({ path: `${prefix}${entry.name}`, data });
		}
	};
	await walk(directoryPath, "", 0);
	return readThemeBundle(collected);
}
