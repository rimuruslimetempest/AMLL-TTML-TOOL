import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scripts = [
	"validate-theme-registry.mjs",
	"validate-plugin-registry.mjs",
];

for (const script of scripts) {
	const result = spawnSync(
		process.execPath,
		[fileURLToPath(new URL(script, import.meta.url))],
		{ stdio: "inherit" },
	);
	if (result.error) {
		console.error(`Could not run ${script}: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Marketplace validation finished: themes and plugins are consistent.");
