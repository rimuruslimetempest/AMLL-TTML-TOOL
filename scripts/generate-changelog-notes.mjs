import { existsSync, readFileSync, writeFileSync } from "node:fs";

const readArgument = (name) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};

const version = readArgument("--version");
const output = readArgument("--output") ?? "release-notes.md";

if (!version) {
	throw new Error(
		"Usage: node scripts/generate-changelog-notes.mjs --version X.Y.Z [--output file]",
	);
}

const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function readCuratedNotes() {
	if (!existsSync("RELEASE_NOTES.md")) return null;
	const text = readFileSync("RELEASE_NOTES.md", "utf8").trim();
	const lines = text.split(/\r?\n/);
	const title = lines[0]?.trim() ?? "";
	if (!new RegExp(`^#\\s+TTML Tool\\s+v?${escapedVersion}$`, "i").test(title)) {
		return null;
	}
	return lines.slice(1).join("\n").trim();
}

function readChangelogNotes() {
	const text = readFileSync("CHANGELOG.md", "utf8");
	const heading = `## [${version}]`;
	const start = text.indexOf(heading);

	if (start === -1) {
		throw new Error(
			`No CHANGELOG.md section found for ${version}. Add a '## [${version}] - YYYY-MM-DD' section before tagging.`,
		);
	}

	const afterHeading = text.slice(start);
	const nextHeading = afterHeading.indexOf("\n## [", heading.length);
	const section =
		nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
	const body = section
		.split(/\r?\n/)
		.slice(1)
		.join("\n")
		.replace(/^\s+|\s+$/g, "");

	if (!body) {
		throw new Error(`The CHANGELOG.md section for ${version} is empty.`);
	}

	return body;
}

const body = readCuratedNotes() ?? readChangelogNotes();
writeFileSync(output, `${body}\n`);
console.log(`Wrote release notes for ${version} to ${output}.`);
