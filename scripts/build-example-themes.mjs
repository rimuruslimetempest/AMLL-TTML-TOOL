import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

const dark = {
	bgBase: "#07070b",
	bgRaised: "#0e0e14",
	bgOverlay: "#15151d",
	surface: "#101016",
	surface2: "#16161f",
	surface3: "#1c1c26",
	surfaceHover: "#20202b",
	border: "rgba(255, 255, 255, 0.09)",
	borderStrong: "rgba(255, 255, 255, 0.17)",
	text: "#f4f6fb",
	textSecondary: "#b9becd",
	textMuted: "#8d94a5",
	textDisabled: "#5e6473",
	accent: "#5b5ef0",
	accentHover: "#797bf3",
	accentActive: "#474aca",
	accentSubtle: "rgba(91, 94, 240, 0.16)",
	accentContrast: "#ffffff",
	success: "#55d68b",
	successSubtle: "rgba(85, 214, 139, 0.12)",
	warning: "#f2bd5c",
	warningSubtle: "rgba(242, 189, 92, 0.12)",
	danger: "#f07476",
	dangerSubtle: "rgba(240, 116, 118, 0.12)",
	info: "#71b7ff",
	infoSubtle: "rgba(113, 183, 255, 0.12)",
	lyricPlaying: "#a9b4ff",
	lyricPlayingBg: "rgba(91, 94, 240, 0.15)",
	lyricSelectedBg: "rgba(91, 94, 240, 0.19)",
	lyricUnsynced: "#f2bd5c",
	lyricUnsyncedBg: "rgba(242, 189, 92, 0.1)",
	lyricSynced: "#55d68b",
	lyricSyncedBg: "rgba(85, 214, 139, 0.09)",
	lyricFlagged: "#f07476",
	lyricFlaggedBg: "rgba(240, 116, 118, 0.1)",
	lyricLocked: "#b89cff",
	lyricLockedBg: "rgba(184, 156, 255, 0.1)",
	timestampBg: "rgba(255, 255, 255, 0.08)",
	timestampText: "#f4f6fb",
	timestampBorder: "rgba(255, 255, 255, 0.16)",
};

const light = {
	bgBase: "#f3f5f9",
	bgRaised: "#ffffff",
	bgOverlay: "#ffffff",
	surface: "#ffffff",
	surface2: "#edf0f6",
	surface3: "#e4e9f1",
	surfaceHover: "#e8edf5",
	border: "rgba(15, 23, 42, 0.12)",
	borderStrong: "rgba(15, 23, 42, 0.22)",
	text: "#10121a",
	textSecondary: "#495266",
	textMuted: "#6a7486",
	textDisabled: "#98a1b0",
	accent: "#5b5ef0",
	accentHover: "#4a4ddc",
	accentActive: "#393cb4",
	accentSubtle: "rgba(91, 94, 240, 0.12)",
	accentContrast: "#ffffff",
	success: "#16844b",
	successSubtle: "rgba(22, 132, 75, 0.1)",
	warning: "#946200",
	warningSubtle: "rgba(148, 98, 0, 0.1)",
	danger: "#c62f36",
	dangerSubtle: "rgba(198, 47, 54, 0.09)",
	info: "#1769b0",
	infoSubtle: "rgba(23, 105, 176, 0.09)",
	lyricPlaying: "#303fd0",
	lyricPlayingBg: "rgba(91, 94, 240, 0.1)",
	lyricSelectedBg: "rgba(91, 94, 240, 0.13)",
	lyricUnsynced: "#8d6100",
	lyricUnsyncedBg: "rgba(141, 97, 0, 0.1)",
	lyricSynced: "#137a46",
	lyricSyncedBg: "rgba(19, 122, 70, 0.08)",
	lyricFlagged: "#b52831",
	lyricFlaggedBg: "rgba(181, 40, 49, 0.09)",
	lyricLocked: "#6941c6",
	lyricLockedBg: "rgba(105, 65, 198, 0.08)",
	timestampBg: "rgba(15, 23, 42, 0.07)",
	timestampText: "#10121a",
	timestampBorder: "rgba(15, 23, 42, 0.15)",
};

const themes = [
	{
		id: "midnight-neon",
		name: "Midnight Neon",
		author: "Rimurulover",
		version: "1.0.0",
		description:
			"Deep blue-violet panels with neon pink and violet highlights. A dark theme for late-night timing sessions.",
		tags: ["dark", "neon", "purple", "high-contrast"],
		appearance: "dark",
		performance: "light",
		minAppVersion: "1.0.0",
		verified: true,
		tokens: {
			...dark,
			bgBase: "#05030d",
			bgRaised: "#0b0718",
			bgOverlay: "#120b25",
			surface: "#0e0820",
			surface2: "#160d2e",
			surface3: "#21123f",
			surfaceHover: "#2c1853",
			border: "rgba(208, 166, 255, 0.15)",
			borderStrong: "rgba(224, 192, 255, 0.34)",
			text: "#f8f1ff",
			textSecondary: "#cdb9e8",
			textMuted: "#9a82bc",
			accent: "#b06bff",
			accentHover: "#c795ff",
			accentActive: "#9648e8",
			accentSubtle: "rgba(176, 107, 255, 0.18)",
			accentContrast: "#12041f",
			success: "#5ef2c5",
			warning: "#ffd166",
			danger: "#ff5e9c",
			info: "#6ecbff",
			lyricPlaying: "#d6b6ff",
			lyricPlayingBg: "rgba(176, 107, 255, 0.18)",
			lyricUnsynced: "#ffd166",
			lyricSynced: "#5ef2c5",
			lyricFlagged: "#ff5e9c",
			lyricLocked: "#8eb8ff",
			timestampBg: "rgba(255, 94, 196, 0.1)",
			timestampBorder: "rgba(255, 94, 196, 0.28)",
		},
		css: `html[data-ui-layer="new"][data-theme="midnight-neon"] [data-ui-chrome="audiobar"],
html[data-ui-layer="new"][data-theme="midnight-neon"] .rt-BaseButton:not(.rt-ghost) {
	box-shadow: 0 0 20px -10px rgba(176, 107, 255, 0.7) !important;
}
`,
	},
	{
		id: "sakura",
		name: "Sakura",
		author: "Rimurulover",
		version: "1.0.0",
		description:
			"Soft blossom pink and warm cream, designed for daylight editing. Gentle borders keep the lyric grid calm.",
		tags: ["light", "pink", "soft", "daylight"],
		appearance: "light",
		performance: "light",
		minAppVersion: "1.0.0",
		verified: true,
		tokens: {
			...light,
			bgBase: "#fff4f7",
			bgRaised: "#fffafb",
			bgOverlay: "#ffffff",
			surface: "#fffafb",
			surface2: "#ffeef3",
			surface3: "#ffdfe9",
			surfaceHover: "#ffd6e3",
			border: "rgba(122, 47, 74, 0.13)",
			borderStrong: "rgba(122, 47, 74, 0.25)",
			text: "#41232e",
			textSecondary: "#754b5b",
			textMuted: "#9b7180",
			textDisabled: "#c3a3ad",
			accent: "#d94f7d",
			accentHover: "#bd3f69",
			accentActive: "#9f3156",
			accentSubtle: "rgba(217, 79, 125, 0.12)",
			accentContrast: "#ffffff",
			success: "#2f7d4a",
			warning: "#936400",
			danger: "#b42f43",
			info: "#2f6f9e",
			lyricPlaying: "#ad2d5c",
			lyricPlayingBg: "rgba(217, 79, 125, 0.1)",
			lyricSelectedBg: "rgba(217, 79, 125, 0.14)",
			lyricUnsynced: "#8a5a00",
			lyricSynced: "#2f7d4a",
			lyricFlagged: "#b42f43",
			lyricLocked: "#7650a9",
			timestampBg: "rgba(217, 79, 125, 0.08)",
			timestampBorder: "rgba(217, 79, 125, 0.2)",
		},
		css: "",
	},
	{
		id: "nord-style",
		name: "Nord-style",
		author: "Rimurulover",
		version: "1.0.0",
		description:
			"Cool blue-gray surfaces and frosty accents inspired by the Nord palette. Quiet contrast for long projects.",
		tags: ["dark", "nord", "blue", "calm"],
		appearance: "dark",
		performance: "light",
		minAppVersion: "1.0.0",
		verified: true,
		tokens: {
			...dark,
			bgBase: "#2e3440",
			bgRaised: "#3b4252",
			bgOverlay: "#434c5e",
			surface: "#343b48",
			surface2: "#3f4756",
			surface3: "#4c566a",
			surfaceHover: "#566176",
			border: "rgba(216, 222, 233, 0.14)",
			borderStrong: "rgba(216, 222, 233, 0.28)",
			text: "#eceff4",
			textSecondary: "#d8dee9",
			textMuted: "#a8b2c3",
			textDisabled: "#7c879b",
			accent: "#88c0d0",
			accentHover: "#9ed0dd",
			accentActive: "#6fa8b8",
			accentSubtle: "rgba(136, 192, 208, 0.16)",
			accentContrast: "#1b222c",
			success: "#a3be8c",
			warning: "#ebcb8b",
			danger: "#bf616a",
			info: "#81a1c1",
			lyricPlaying: "#b8dce6",
			lyricPlayingBg: "rgba(136, 192, 208, 0.14)",
			lyricUnsynced: "#ebcb8b",
			lyricSynced: "#a3be8c",
			lyricFlagged: "#bf616a",
			lyricLocked: "#b48ead",
			timestampBg: "rgba(136, 192, 208, 0.1)",
			timestampBorder: "rgba(136, 192, 208, 0.24)",
		},
		css: "",
	},
];

function previewSvg(theme) {
	const t = theme.tokens;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450" role="img" aria-label="${theme.name} theme preview">
  <rect width="800" height="450" fill="${t.bgBase}"/>
  <rect x="0" y="0" width="800" height="42" fill="${t.bgRaised}"/>
  <circle cx="20" cy="21" r="5" fill="${t.accent}"/>
  <rect x="34" y="17" width="70" height="8" rx="4" fill="${t.textMuted}"/>
  <rect x="620" y="14" width="60" height="14" rx="7" fill="${t.accentSubtle}"/>
  <rect x="700" y="14" width="80" height="14" rx="7" fill="${t.surface3}"/>
  <rect x="0" y="42" width="150" height="348" fill="${t.bgRaised}"/>
  <rect x="14" y="62" width="110" height="10" rx="5" fill="${t.text}"/>
  <rect x="14" y="86" width="88" height="8" rx="4" fill="${t.textMuted}"/>
  <rect x="14" y="118" width="120" height="16" rx="6" fill="${t.accentSubtle}"/>
  <rect x="14" y="146" width="96" height="12" rx="6" fill="${t.surface2}"/>
  <rect x="14" y="170" width="106" height="12" rx="6" fill="${t.surface2}"/>
  <rect x="14" y="194" width="78" height="12" rx="6" fill="${t.surface2}"/>
  <rect x="180" y="66" width="330" height="10" rx="5" fill="${t.textMuted}"/>
  <rect x="180" y="96" width="250" height="14" rx="7" fill="${t.text}"/>
  <rect x="180" y="126" width="300" height="14" rx="7" fill="${t.textSecondary}"/>
  <rect x="180" y="160" width="180" height="22" rx="8" fill="${t.lyricPlayingBg}" stroke="${t.accent}" stroke-opacity="0.5"/>
  <rect x="190" y="168" width="120" height="7" rx="3.5" fill="${t.lyricPlaying}"/>
  <rect x="180" y="196" width="270" height="14" rx="7" fill="${t.textDisabled}"/>
  <rect x="180" y="226" width="220" height="14" rx="7" fill="${t.textSecondary}"/>
  <rect x="180" y="256" width="290" height="14" rx="7" fill="${t.textMuted}"/>
  <rect x="180" y="300" width="64" height="18" rx="9" fill="${t.lyricSyncedBg}"/>
  <rect x="252" y="300" width="64" height="18" rx="9" fill="${t.lyricUnsyncedBg}"/>
  <rect x="324" y="300" width="64" height="18" rx="9" fill="${t.timestampBg}"/>
  <rect x="0" y="390" width="800" height="60" fill="${t.bgRaised}"/>
  <circle cx="34" cy="420" r="14" fill="${t.accent}"/>
  <polygon points="30,413 30,427 42,420" fill="${t.accentContrast}"/>
  <rect x="60" y="408" width="110" height="8" rx="4" fill="${t.textSecondary}"/>
  <rect x="60" y="424" width="70" height="6" rx="3" fill="${t.textMuted}"/>
  <rect x="190" y="414" width="540" height="10" rx="5" fill="${t.surface3}"/>
  <rect x="190" y="414" width="310" height="10" rx="5" fill="${t.accent}"/>
  <rect x="748" y="408" width="34" height="22" rx="6" fill="${t.accentSubtle}"/>
</svg>
`;
}

await mkdir(join(docs, "registry/themes"), { recursive: true });
await mkdir(join(docs, "assets/previews"), { recursive: true });

const entries = [];
for (const theme of themes) {
	const manifest = {
		format: 1,
		id: theme.id,
		name: theme.name,
		author: theme.author,
		version: theme.version,
		description: theme.description,
		schemes: [
			{
				id: theme.appearance === "dark" ? "night" : "day",
				name: theme.appearance === "dark" ? "Night" : "Day",
				appearance: theme.appearance,
				tokens: theme.tokens,
			},
		],
		effects: { level: "none", performance: theme.performance },
		minAppVersion: theme.minAppVersion,
		...(theme.css ? { css: theme.css } : {}),
	};
	const json = `${JSON.stringify(manifest, null, 2)}\n`;
	const downloadPath = `registry/themes/${theme.id}.json`;
	await writeFile(join(docs, downloadPath), json);
	await writeFile(
		join(docs, `assets/previews/${theme.id}.svg`),
		previewSvg(theme),
	);
	entries.push({
		id: theme.id,
		name: theme.name,
		author: theme.author,
		version: theme.version,
		description: theme.description,
		tags: theme.tags,
		appearance: theme.appearance,
		preview: `assets/previews/${theme.id}.svg`,
		download: downloadPath,
		sha256: createHash("sha256").update(json).digest("hex"),
		size: Buffer.byteLength(json),
		performance: theme.performance,
		minAppVersion: theme.minAppVersion,
		verified: theme.verified,
	});
}

const exampleIds = new Set(entries.map((entry) => entry.id));
let existingThemes = [];
try {
	const existing = JSON.parse(
		await readFile(join(docs, "registry/themes.json"), "utf8"),
	);
	if (Array.isArray(existing.themes)) {
		existingThemes = existing.themes.filter(
			(entry) => entry && !exampleIds.has(entry.id),
		);
	}
} catch {
	// The first run has no registry yet.
}

const registry = {
	version: 1,
	updatedAt: "2026-11-19",
	themes: [...entries, ...existingThemes],
};
await writeFile(
	join(docs, "registry/themes.json"),
	`${JSON.stringify(registry, null, 2)}\n`,
);
console.log(`Wrote ${entries.length} marketplace themes.`);
