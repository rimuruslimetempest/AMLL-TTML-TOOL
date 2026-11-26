import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
	process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "docs"),
);
const registryPath = join(root, "registry/plugins.json");
const MAX_PLUGIN_BYTES = 2 * 1024 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/i;
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
const TYPES = new Set(["importer", "exporter", "tool", "both"]);
const PERMISSIONS = new Set([
	"lyrics:read",
	"lyrics:write",
	"files:read",
	"files:write",
	"network",
	"settings:read",
	"ui:toolbar",
	"ui:panel",
]);
const SLOTS = new Set(["toolbar", "panel", "import-dialog", "export-dialog"]);
const ENTRY_FIELDS = new Set([
	"id",
	"name",
	"author",
	"version",
	"description",
	"tags",
	"type",
	"apiVersion",
	"permissions",
	"slots",
	"download",
	"sha256",
	"size",
	"minAppVersion",
	"addedAt",
	"verified",
	"deprecated",
	"homepage",
	"changelog",
]);
const MANIFEST_FIELDS = new Set([
	"id",
	"name",
	"description",
	"author",
	"version",
	"type",
	"apiVersion",
	"permissions",
	"slots",
	"homepage",
	"techniques",
	"usage",
]);

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);

function isInside(base, target) {
	const rel = relative(base, target);
	return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function sameSet(left = [], right = []) {
	const a = [...new Set(left)].sort();
	const b = [...new Set(right)].sort();
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isStringList(value) {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === "string" && item.trim())
	);
}

if (!existsSync(registryPath)) {
	console.error(`Missing registry: ${registryPath}`);
	process.exit(1);
}

let registry;
try {
	registry = JSON.parse(await readFile(registryPath, "utf8"));
} catch (error) {
	console.error(`Could not parse registry/plugins.json: ${error.message}`);
	process.exit(1);
}

if (registry.version !== 1) fail("registry.version must be 1.");
if (typeof registry.updatedAt !== "string" || !registry.updatedAt)
	fail("registry.updatedAt is required.");
if (!Array.isArray(registry.plugins)) {
	console.error("registry.plugins must be an array.");
	process.exit(1);
}

const seen = new Set();
for (const [index, entry] of registry.plugins.entries()) {
	const label = `plugins[${index}]${entry?.id ? ` (${entry.id})` : ""}`;
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		fail(`${label} must be an object.`);
		continue;
	}
	for (const key of Object.keys(entry)) {
		if (!ENTRY_FIELDS.has(key)) fail(`${label}.${key} is not a known field.`);
	}
	for (const field of [
		"id",
		"name",
		"author",
		"version",
		"description",
		"download",
		"sha256",
		"minAppVersion",
		"addedAt",
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
	if (typeof entry.addedAt === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(entry.addedAt))
		fail(`${label}.addedAt must look like 2026-11-24.`);
	if (!TYPES.has(entry.type))
		fail(`${label}.type must be importer, exporter, tool, or both.`);
	if (entry.apiVersion !== 2)
		fail(`${label}.apiVersion must be 2; the marketplace only lists API 2.0 plugins.`);
	if (!isStringList(entry.tags) || entry.tags.length === 0 || entry.tags.length > 8)
		fail(`${label}.tags must be 1-8 non-empty strings.`);
	if (entry.permissions !== undefined) {
		if (!isStringList(entry.permissions)) {
			fail(`${label}.permissions must be an array of strings.`);
		} else {
			for (const permission of entry.permissions) {
				if (!PERMISSIONS.has(permission))
					fail(`${label}.permissions contains ${permission}, which is not allowed.`);
			}
		}
	}
	if (entry.slots !== undefined) {
		if (!isStringList(entry.slots)) {
			fail(`${label}.slots must be an array of strings.`);
		} else {
			for (const slot of entry.slots) {
				if (!SLOTS.has(slot))
					fail(`${label}.slots contains ${slot}, which is not allowed.`);
			}
		}
	}
	if (entry.verified !== undefined && typeof entry.verified !== "boolean")
		fail(`${label}.verified must be true or false.`);
	if (entry.deprecated !== undefined && typeof entry.deprecated !== "boolean")
		fail(`${label}.deprecated must be true or false.`);
	if (
		entry.homepage !== undefined &&
		(typeof entry.homepage !== "string" || !/^https:\/\//i.test(entry.homepage))
	)
		fail(`${label}.homepage must be an https URL.`);
	if (
		entry.changelog !== undefined &&
		(typeof entry.changelog !== "string" || entry.changelog.length > 2000)
	)
		fail(`${label}.changelog must be a string under 2000 characters.`);
	if (
		typeof entry.sha256 === "string" &&
		!/^[a-f0-9]{64}$/.test(entry.sha256)
	)
		fail(`${label}.sha256 must be a lowercase SHA-256 hex digest.`);
	if (entry.size !== undefined && typeof entry.size !== "number")
		fail(`${label}.size must be a number when present.`);

	if (typeof entry.download !== "string") continue;
	if (/^https?:\/\//i.test(entry.download)) {
		fail(`${label}.download must be a path inside docs/, not a remote URL.`);
		continue;
	}
	if (!entry.download.endsWith(".wasm"))
		fail(`${label}.download must point at a .wasm file.`);
	const wasmPath = resolve(root, entry.download);
	if (!isInside(root, wasmPath)) {
		fail(`${label}.download escapes the docs folder.`);
		continue;
	}
	if (!existsSync(wasmPath)) {
		fail(`${label}.download does not exist: ${entry.download}`);
		continue;
	}
	const bytes = await readFile(wasmPath);
	if (bytes.byteLength > MAX_PLUGIN_BYTES) {
		fail(
			`${label}.download is ${bytes.byteLength} bytes; the limit is ${MAX_PLUGIN_BYTES}.`,
		);
		continue;
	}
	if (bytes.byteLength < 8) {
		fail(`${label}.download is too small to be a WebAssembly module.`);
		continue;
	}
	for (const [offset, value] of WASM_MAGIC.entries()) {
		if (bytes[offset] !== value) {
			fail(`${label}.download is not a WebAssembly module (bad magic bytes).`);
			break;
		}
	}
	if (bytes.readUInt32LE(4) !== 1)
		fail(`${label}.download is not a WebAssembly 1.0 module.`);
	const digest = createHash("sha256").update(bytes).digest("hex");
	if (digest !== entry.sha256)
		fail(`${label}.sha256 does not match the plugin file.`);
	if (entry.size !== undefined && entry.size !== bytes.byteLength)
		fail(`${label}.size does not match the plugin file.`);

	const manifestPath = join(dirname(wasmPath), "plugin.json");
	if (!existsSync(manifestPath)) {
		fail(`${label} is missing its sibling plugin.json manifest.`);
		continue;
	}
	let manifest;
	try {
		manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	} catch {
		fail(`${label} plugin.json is not valid JSON.`);
		continue;
	}
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		fail(`${label} plugin.json must be an object.`);
		continue;
	}
	for (const key of Object.keys(manifest)) {
		if (!MANIFEST_FIELDS.has(key))
			fail(`${label} plugin.json has an unknown field: ${key}.`);
	}
	for (const field of ["id", "name", "author", "version", "description"]) {
		if (typeof manifest[field] !== "string" || !manifest[field].trim())
			fail(`${label} plugin.json is missing ${field}.`);
	}
	if (manifest.id !== entry.id)
		fail(`${label}.id does not match plugin.json (${manifest.id}).`);
	if (manifest.name !== entry.name)
		warnings.push(`${label}.name differs from plugin.json name.`);
	if (manifest.author !== entry.author)
		fail(`${label}.author does not match plugin.json author.`);
	if (manifest.version !== entry.version)
		fail(`${label}.version does not match plugin.json version.`);
	if (manifest.type !== entry.type)
		fail(`${label}.type does not match plugin.json type.`);
	if (manifest.apiVersion !== 2)
		fail(`${label} plugin.json apiVersion must be 2.`);
	if (!sameSet(manifest.permissions, entry.permissions))
		fail(`${label}.permissions do not match plugin.json permissions.`);
	if (!sameSet(manifest.slots, entry.slots))
		fail(`${label}.slots do not match plugin.json slots.`);
	const serialized = JSON.stringify(manifest);
	if (/<script\b|javascript\s*:/i.test(serialized))
		fail(`${label} plugin.json contains script-like content.`);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length > 0) {
	console.error(`Plugin registry validation failed with ${errors.length} error(s):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}
console.log(
	`Plugin registry OK: ${registry.plugins.length} plugin(s), hashes, manifests, and WASM headers verified.`,
);
