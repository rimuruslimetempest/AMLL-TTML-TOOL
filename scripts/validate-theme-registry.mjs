import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
	process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "docs"),
);
const registryPath = join(root, "registry/themes.json");
const MAX_THEME_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 1 * 1024 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/i;
const PERFORMANCE = new Set(["light", "medium", "heavy"]);
const APPEARANCE = new Set(["dark", "light"]);
const PREVIEW_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".webp"];
const REMOTE_URL = /\burl\(\s*['"]?\s*(?:https?:)?\/\//i;
const REMOTE_IMPORT = /@import\s+(?:url\()?\s*['"]?\s*(?:https?:)?\/\//i;
const SCRIPT = /<script\b|javascript\s*:|expression\s*\(|<\/style/i;

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);

function isInside(base, target) {
	const rel = relative(base, target);
	return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

async function readMaybeRemote(value) {
	if (/^https?:\/\//i.test(value)) {
		const response = await fetch(value, {
			headers: { "user-agent": "ttml-tool-theme-registry-validator" },
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return Buffer.from(await response.arrayBuffer());
	}
	const target = resolve(root, value);
	if (!isInside(root, target)) throw new Error("path escapes the docs folder");
	if (!existsSync(target)) throw new Error("file does not exist");
	return readFile(target);
}

if (!existsSync(registryPath)) {
	console.error(`Missing registry: ${registryPath}`);
	process.exit(1);
}

let registry;
try {
	registry = JSON.parse(await readFile(registryPath, "utf8"));
} catch (error) {
	console.error(`Could not parse registry/themes.json: ${error.message}`);
	process.exit(1);
}

if (registry.version !== 1) fail("registry.version must be 1.");
if (typeof registry.updatedAt !== "string" || !registry.updatedAt)
	fail("registry.updatedAt is required.");
if (!Array.isArray(registry.themes)) {
	console.error("registry.themes must be an array.");
	process.exit(1);
}

const seen = new Set();
for (const [index, entry] of registry.themes.entries()) {
	const label = `themes[${index}]${entry?.id ? ` (${entry.id})` : ""}`;
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		fail(`${label} must be an object.`);
		continue;
	}
	for (const field of [
		"id",
		"name",
		"author",
		"version",
		"description",
		"preview",
		"download",
		"sha256",
		"performance",
		"minAppVersion",
		"appearance",
	]) {
		if (typeof entry[field] !== "string" || !entry[field].trim())
			fail(`${label}.${field} is required.`);
	}
	if (typeof entry.id === "string") {
		if (!ID_PATTERN.test(entry.id))
			fail(`${label}.id must use lowercase letters, numbers, and dashes.`);
		if (seen.has(entry.id)) fail(`${label}.id is duplicated.`);
		seen.add(entry.id);
	}
	if (typeof entry.version === "string" && !VERSION_PATTERN.test(entry.version))
		fail(`${label}.version must look like 1.0.0.`);
	if (
		typeof entry.minAppVersion === "string" &&
		!VERSION_PATTERN.test(entry.minAppVersion)
	)
		fail(`${label}.minAppVersion must look like 1.0.0.`);
	if (!PERFORMANCE.has(entry.performance))
		fail(`${label}.performance must be light, medium, or heavy.`);
	if (!APPEARANCE.has(entry.appearance))
		fail(`${label}.appearance must be dark or light.`);
	if (
		!Array.isArray(entry.tags) ||
		entry.tags.length === 0 ||
		entry.tags.length > 8 ||
		!entry.tags.every((tag) => typeof tag === "string" && tag.trim())
	) {
		fail(`${label}.tags must be 1-8 non-empty strings.`);
	}
	if (entry.verified !== undefined && typeof entry.verified !== "boolean")
		fail(`${label}.verified must be true or false.`);
	if (
		typeof entry.sha256 === "string" &&
		!/^[a-f0-9]{64}$/.test(entry.sha256)
	)
		fail(`${label}.sha256 must be a lowercase SHA-256 hex digest.`);
	if (entry.size !== undefined && typeof entry.size !== "number")
		fail(`${label}.size must be a number when present.`);

	if (typeof entry.preview === "string") {
		const isRemote = /^https?:\/\//i.test(entry.preview);
		if (!isRemote && !PREVIEW_EXTENSIONS.some((ext) => entry.preview.endsWith(ext)))
			fail(`${label}.preview must be an SVG, PNG, JPEG, or WebP file.`);
		if (!isRemote) {
			const previewPath = resolve(root, entry.preview);
			if (!isInside(root, previewPath))
				fail(`${label}.preview escapes the docs folder.`);
			else if (!existsSync(previewPath))
				fail(`${label}.preview does not exist: ${entry.preview}`);
		}
	}

	if (typeof entry.download !== "string") continue;

	let bytes;
	try {
		bytes = await readMaybeRemote(entry.download);
	} catch (error) {
		fail(`${label}.download could not be read: ${error.message}`);
		continue;
	}
	if (bytes.byteLength > MAX_THEME_BYTES) {
		fail(
			`${label}.download is ${bytes.byteLength} bytes; the limit is ${MAX_THEME_BYTES}.`,
		);
		continue;
	}
	const digest = createHash("sha256").update(bytes).digest("hex");
	if (digest !== entry.sha256)
		fail(`${label}.sha256 does not match the downloaded theme file.`);
	if (entry.size !== undefined && entry.size !== bytes.byteLength)
		fail(`${label}.size does not match the theme file.`);

	let manifest;
	try {
		manifest = JSON.parse(bytes.toString("utf8"));
	} catch {
		fail(`${label}.download is not valid JSON.`);
		continue;
	}
	if (manifest.format !== 1) fail(`${label} theme.format must be 1.`);
	if (manifest.id !== entry.id)
		fail(`${label}.id does not match theme.id (${manifest.id}).`);
	if (manifest.name !== entry.name)
		warnings.push(`${label}.name differs from theme.name.`);
	if (manifest.version !== entry.version)
		fail(`${label}.version does not match theme.version.`);
	if (manifest.author !== entry.author)
		fail(`${label}.author does not match theme.author.`);
	if (!Array.isArray(manifest.schemes) || manifest.schemes.length === 0)
		fail(`${label} theme has no color schemes.`);
	if (typeof manifest.css === "string") {
		if (manifest.css.length > 500_000)
			fail(`${label} theme.css is larger than 500 KB.`);
		if (REMOTE_URL.test(manifest.css))
			fail(`${label} theme.css contains a remote url().`);
		if (REMOTE_IMPORT.test(manifest.css))
			fail(`${label} theme.css contains a remote @import.`);
		if (SCRIPT.test(manifest.css))
			fail(`${label} theme.css contains script-like content.`);
	}
	const serialized = JSON.stringify(manifest);
	if (SCRIPT.test(serialized))
		fail(`${label} theme contains script-like content.`);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length > 0) {
	console.error(`Theme registry validation failed with ${errors.length} error(s):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}
console.log(
	`Theme registry OK: ${registry.themes.length} theme(s), hashes and previews verified.`,
);
