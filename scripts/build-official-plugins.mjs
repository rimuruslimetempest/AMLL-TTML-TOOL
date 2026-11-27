import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const MAX_PLUGIN_BYTES = 2 * 1024 * 1024;
const catalogPath = join(root, "plugins/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
	throw new Error("plugins/catalog.json must contain at least one plugin.");
}

const updatedAt = new Date().toISOString().slice(0, 10);
const officialPlugins = [];
const marketplacePlugins = [];

for (const entry of catalog.plugins) {
	const { lib, ...metadata } = entry;
	if (!entry.id || !lib) {
		throw new Error("Every catalog entry needs an id and a lib name.");
	}
	const pluginDir = join(root, "plugins", entry.id);
	const manifestPath = join(pluginDir, "plugin.json");
	if (!existsSync(manifestPath)) {
		throw new Error(`Missing plugin manifest: ${manifestPath}`);
	}
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	for (const key of ["id", "name", "author", "version", "type"]) {
		if (manifest[key] !== metadata[key]) {
			throw new Error(
				`plugins/catalog.json and ${entry.id}/plugin.json disagree on ${key}.`,
			);
		}
	}

	console.log(`\nBuilding ${entry.name} (${entry.id})...`);
	execFileSync(
		process.env.CARGO ?? "cargo",
		[
			"build",
			"--locked",
			"--manifest-path",
			join(pluginDir, "Cargo.toml"),
			"--target",
			"wasm32-unknown-unknown",
			"--release",
		],
		{ cwd: root, stdio: "inherit", env: process.env },
	);

	const wasmPath = join(
		pluginDir,
		"target",
		"wasm32-unknown-unknown",
		"release",
		`${lib}.wasm`,
	);
	if (!existsSync(wasmPath)) {
		throw new Error(`Cargo did not produce ${wasmPath}`);
	}
	const bytes = readFileSync(wasmPath);
	if (bytes.byteLength > MAX_PLUGIN_BYTES) {
		throw new Error(
			`${entry.id} is ${bytes.byteLength} bytes; the plugin limit is ${MAX_PLUGIN_BYTES}.`,
		);
	}
	if (
		bytes[0] !== 0x00 ||
		bytes[1] !== 0x61 ||
		bytes[2] !== 0x73 ||
		bytes[3] !== 0x6d
	) {
		throw new Error(`${entry.id} is not a WebAssembly module.`);
	}

	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const size = bytes.byteLength;
	const publicDir = join(root, "public", "plugins");
	const marketplaceDir = join(root, "docs", "registry", "plugins", entry.id);
	mkdirSync(publicDir, { recursive: true });
	mkdirSync(marketplaceDir, { recursive: true });

	writeFileSync(join(publicDir, `${entry.id}.wasm`), bytes);
	writeFileSync(join(marketplaceDir, "plugin.wasm"), bytes);
	writeFileSync(
		join(marketplaceDir, "plugin.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);

	officialPlugins.push({
		...metadata,
		download: `/plugins/${entry.id}.wasm`,
		sha256,
		size,
	});
	marketplacePlugins.push({
		...metadata,
		download: `registry/plugins/${entry.id}/plugin.wasm`,
		sha256,
		size,
	});
	console.log(`  ${size} bytes · ${sha256}`);
}

writeFileSync(
	join(root, "src", "modules", "plugins", "official-plugins.json"),
	`${JSON.stringify({ version: 1, updatedAt, plugins: officialPlugins }, null, 2)}\n`,
);
writeFileSync(
	join(root, "docs", "registry", "plugins.json"),
	`${JSON.stringify({ version: 1, updatedAt, plugins: marketplacePlugins }, null, 2)}\n`,
);

console.log(
	`\nWrote ${officialPlugins.length} official plugins to the app and marketplace catalogs.`,
);
