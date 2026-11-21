import { readFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);

function argument(name, fallback) {
	const index = args.indexOf(name);
	return index === -1 ? fallback : args[index + 1];
}

const assetsFile = argument("--assets-file");
const updaterFile = argument("--updater-file");
const version = argument("--version");
const withoutUpdater = args.includes("--without-updater");

if (!assetsFile || (!updaterFile && !withoutUpdater) || !version) {
	throw new Error(
		"Usage: node scripts/verify-release-assets.mjs --assets-file assets.json --version X.Y.Z [--updater-file latest.json | --without-updater]",
	);
}

const parsed = JSON.parse(readFileSync(assetsFile, "utf8"));
const assets = Array.isArray(parsed) ? parsed : parsed.assets;
if (!Array.isArray(assets))
	throw new Error("The release asset list is not an array.");

const names = assets
	.filter((asset) => !asset.state || asset.state === "uploaded")
	.map((asset) => asset.name);

const checks = [
	["Windows NSIS installer", /-setup\.exe$/],
	["Windows MSI installer", /\.msi$/],
	["macOS Apple Silicon DMG", /_aarch64\.dmg$/],
	["macOS Intel DMG", /_x64\.dmg$/],
	["Linux AppImage", /_amd64\.AppImage$/],
	["Linux deb package", /_amd64\.deb$/],
	["Linux rpm package", /_x86_64\.rpm$/],
];

if (!withoutUpdater) checks.push(["latest.json", /^latest\.json$/]);

const updaterChecks = [
	["Windows updater", /-setup\.nsis\.zip$|-setup\.exe$/],
	["macOS Apple Silicon updater", /_aarch64\.app\.tar\.gz$/],
	["macOS Intel updater", /_x64\.app\.tar\.gz$/],
	["Linux updater", /_amd64\.AppImage\.tar\.gz$/],
];

const failures = [];
let manifest;

for (const [description, pattern] of checks) {
	if (!names.some((name) => pattern.test(name))) {
		failures.push(`Missing ${description} (${pattern}).`);
	}
}

if (!withoutUpdater) {
	for (const [description, pattern] of updaterChecks) {
		const asset = names.find((name) => pattern.test(name));
		if (!asset) {
			failures.push(`Missing ${description} (${pattern}).`);
		} else if (!names.includes(`${asset}.sig`)) {
			failures.push(`Missing signature for ${asset}.`);
		}
	}

	manifest = JSON.parse(readFileSync(updaterFile, "utf8"));
	if (manifest.version !== version) {
		failures.push(
			`latest.json version is ${manifest.version}, expected ${version}.`,
		);
	}

	for (const platform of [
		"windows-x86_64",
		"darwin-aarch64",
		"darwin-x86_64",
		"linux-x86_64",
	]) {
		const entry = manifest.platforms?.[platform];
		if (!entry?.url) failures.push(`latest.json has no URL for ${platform}.`);
		if (!entry?.signature)
			failures.push(`latest.json has no signature for ${platform}.`);
		if (entry?.url && !/^https:\/\//.test(entry.url)) {
			failures.push(`latest.json URL for ${platform} is not HTTPS.`);
		}
		if (
			entry?.url &&
			!names.some((name) => entry.url.endsWith(`/${encodeURIComponent(name)}`))
		) {
			failures.push(
				`latest.json URL for ${platform} does not name a release asset.`,
			);
		}
	}
} else {
	for (const name of names) {
		if (
			name === "latest.json" ||
			/\.(?:sig|app\.tar\.gz|AppImage\.tar\.gz|nsis\.zip)$/.test(name)
		) {
			failures.push(`Installers-only release still contains ${name}.`);
		}
	}
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`::error::${failure}`);
	process.exit(1);
}

console.log(
	withoutUpdater
		? `Release contains all required installers for ${version}; updater artifacts were skipped.`
		: `Release contains all required assets for ${version}.`,
);
for (const name of names) console.log(`- ${name}`);
if (manifest) {
	console.log(
		`latest.json covers ${Object.keys(manifest.platforms).join(", ")}.`,
	);
}
