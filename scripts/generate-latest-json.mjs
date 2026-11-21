import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);

function argument(name, fallback) {
	const index = args.indexOf(name);
	return index === -1 ? fallback : args[index + 1];
}

const tag = argument("--tag") ?? process.env.RELEASE_TAG;
const version = argument("--version") ?? tag?.replace(/^v/, "");
const repo = argument("--repo") ?? process.env.GITHUB_REPOSITORY;
const notesFile = argument("--notes-file");
const assetsFile = argument("--assets-file");
const output = argument("--output", "latest.json");
const token = process.env.GITHUB_TOKEN;

if (!tag?.startsWith("v") || !version) {
	throw new Error(
		"Usage: node scripts/generate-latest-json.mjs --tag vX.Y.Z --version X.Y.Z",
	);
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
	throw new Error(`Version ${version} is not stable SemVer (X.Y.Z).`);
}
if (tag !== `v${version}`) {
	throw new Error(`Tag ${tag} does not match version ${version}.`);
}
if (!repo) {
	throw new Error("Set GITHUB_REPOSITORY or pass --repo owner/name.");
}

const headers = {
	Accept: "application/vnd.github+json",
	"User-Agent": "ttml-tool-release",
};
if (token) headers.Authorization = `Bearer ${token}`;

async function github(url, accept = "application/vnd.github+json") {
	const response = await fetch(url, {
		headers: { ...headers, Accept: accept },
	});
	if (!response.ok) {
		throw new Error(`GitHub returned ${response.status} for ${url}`);
	}
	return response;
}

let assets;
if (assetsFile) {
	const parsed = JSON.parse(readFileSync(assetsFile, "utf8"));
	assets = Array.isArray(parsed) ? parsed : parsed.assets;
} else {
	const release = await (
		await github(
			`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
		)
	).json();
	const response = await github(
		`https://api.github.com/repos/${repo}/releases/${release.id}/assets?per_page=100`,
	);
	assets = await response.json();
}

if (!Array.isArray(assets)) {
	throw new Error("The release asset list is not an array.");
}

const assetName = (asset) => asset.name ?? asset.label;
const uploaded = assets.filter(
	(asset) => !asset.state || asset.state === "uploaded",
);

function findSignedAsset(candidates, description) {
	for (const predicate of candidates) {
		const asset = uploaded.find((candidate) => predicate(assetName(candidate)));
		if (!asset) continue;
		const signature = uploaded.find(
			(candidate) => assetName(candidate) === `${assetName(asset)}.sig`,
		);
		if (signature) return { asset, signature };
	}
	throw new Error(`Missing ${description} and its .sig file in the release.`);
}

const windows = findSignedAsset(
	[
		(name) => name.endsWith(".nsis.zip"),
		(name) => name.endsWith("-setup.exe"),
		(name) => name.endsWith(".msi"),
	],
	"Windows updater",
);
const macArm = findSignedAsset(
	[(name) => name.endsWith(".app.tar.gz") && /(aarch64|arm64)/i.test(name)],
	"macOS Apple Silicon updater",
);
const macX64 = findSignedAsset(
	[(name) => name.endsWith(".app.tar.gz") && /(x64|x86_64)/i.test(name)],
	"macOS Intel updater",
);
const linux = findSignedAsset(
	[(name) => name.endsWith(".AppImage.tar.gz")],
	"Linux updater",
);

async function signatureFor(signatureAsset) {
	if (typeof signatureAsset.signature === "string") {
		return signatureAsset.signature;
	}
	const url =
		signatureAsset.url ??
		`https://api.github.com/repos/${repo}/releases/assets/${signatureAsset.id}`;
	const response = await github(url, "application/octet-stream");
	const text = await response.text();
	if (!text.trim())
		throw new Error(`Empty signature for ${signatureAsset.name}`);
	return text;
}

function minisignKeyId(encoded, description) {
	const text = Buffer.from(encoded.trim(), "base64").toString("utf8");
	const line = text
		.split(/\r?\n/)
		.find((value) => value && !value.startsWith("untrusted comment:"));
	if (!line) throw new Error(`${description} has no minisign payload.`);
	const raw = Buffer.from(line, "base64");
	if (raw.length !== 74) {
		throw new Error(
			`${description} has an unexpected minisign signature length.`,
		);
	}
	return raw.subarray(2, 10).toString("hex");
}

function configuredKeyId() {
	const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
	const encoded = config.plugins?.updater?.pubkey;
	if (typeof encoded !== "string") {
		throw new Error("The updater public key is missing from tauri.conf.json.");
	}
	const text = Buffer.from(encoded, "base64").toString("utf8");
	const line = text
		.split(/\r?\n/)
		.find((value) => value && !value.startsWith("untrusted comment:"));
	if (!line) throw new Error("The updater public key has no minisign payload.");
	const raw = Buffer.from(line, "base64");
	if (raw.length !== 42) {
		throw new Error(
			"The updater public key has an unexpected minisign length.",
		);
	}
	return raw.subarray(2, 10).toString("hex");
}

function publicUrl(asset) {
	if (asset.browser_download_url) return asset.browser_download_url;
	return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName(asset))}`;
}

const notes = notesFile ? readFileSync(notesFile, "utf8").trim() : "";
const platforms = {
	"windows-x86_64": {
		signature: await signatureFor(windows.signature),
		url: publicUrl(windows.asset),
	},
	"darwin-aarch64": {
		signature: await signatureFor(macArm.signature),
		url: publicUrl(macArm.asset),
	},
	"darwin-x86_64": {
		signature: await signatureFor(macX64.signature),
		url: publicUrl(macX64.asset),
	},
	"linux-x86_64": {
		signature: await signatureFor(linux.signature),
		url: publicUrl(linux.asset),
	},
};

const expectedKeyId = configuredKeyId();
for (const [platform, entry] of Object.entries(platforms)) {
	if (!entry.signature.trim() || !entry.url) {
		throw new Error(`Incomplete updater entry for ${platform}.`);
	}
	const actualKeyId = minisignKeyId(entry.signature, platform);
	if (actualKeyId !== expectedKeyId) {
		throw new Error(
			`${platform} was signed by key ${actualKeyId}, but tauri.conf.json expects ${expectedKeyId}.`,
		);
	}
}

const manifest = {
	version,
	notes,
	pub_date: new Date().toISOString(),
	platforms,
};

writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${output} for ${tag}:`);
for (const [platform, entry] of Object.entries(platforms)) {
	console.log(`- ${platform}: ${entry.url}`);
}
