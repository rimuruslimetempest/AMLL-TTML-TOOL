import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	assertMatchingVersions,
	assertStableVersion,
	loadVersionSources,
	readVersions,
	updateVersionSources,
	VERSION_FILES,
} from "./version-utils.mjs";

const version = process.argv[2];
if (!version) {
	throw new Error("Usage: node scripts/set-version.mjs <X.Y.Z>");
}
assertStableVersion(version, "Version");

const root = process.cwd();
const sources = loadVersionSources(root);
const currentVersion = assertMatchingVersions(readVersions(sources));
if (currentVersion === version) {
	console.log(`Version is already ${version}.`);
	process.exit(0);
}

const updatedSources = updateVersionSources(sources, currentVersion, version);
for (const file of VERSION_FILES) {
	writeFileSync(join(root, file), updatedSources[file]);
}
console.log(`Updated ${currentVersion} -> ${version} in all version files.`);
