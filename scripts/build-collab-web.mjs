import { spawnSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist-collab");
const resourceDir = path.join(root, "src-tauri", "resources", "web");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

const env = { ...process.env };
// The guest build is a normal browser app: relative asset paths and the PWA
// must stay enabled so it works when served from the local collaboration host.
delete env.TAURI_ENV_PLATFORM;
delete env.TAURI_ENV_DEBUG;
delete env.TAURI_PLATFORM;

const result = spawnSync(
	process.execPath,
	[viteBin, "build", "--outDir", outDir, "--emptyOutDir"],
	{ cwd: root, env, stdio: "inherit" },
);

if (result.error) {
	console.error(`Could not start the collaboration web build: ${result.error.message}`);
	process.exit(1);
}
if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

await rm(resourceDir, { recursive: true, force: true });
await mkdir(path.dirname(resourceDir), { recursive: true });
await cp(outDir, resourceDir, { recursive: true });
console.log(`Collaboration web assets copied to ${resourceDir}`);
