import { identifyProject } from "$/modules/project/logic/project-info";
import type { LyricLine, TTMLLyric } from "$/types/ttml";

export interface HandoffSummaryInput {
	lyric: TTMLLyric;
	fileName: string;
	audioFileName?: string | null;
	syncTimeOffset?: number;
	generatedAt?: Date;
}

export interface HandoffStats {
	lines: number;
	words: number;
	timedLines: number;
	untimedLines: number;
	timedWords: number;
	untimedWords: number;
	backgroundLines: number;
	duetLines: number;
	emptyLines: number;
	sections: number;
	marks: number;
	startTime: number | null;
	endTime: number | null;
	wordCoverage: number;
	lineCoverage: number;
}

const isTimed = (startTime: number, endTime: number) =>
	startTime > 0 && endTime > startTime;

export function getHandoffStats(lyric: TTMLLyric): HandoffStats {
	let words = 0;
	let timedWords = 0;
	let timedLines = 0;
	let backgroundLines = 0;
	let duetLines = 0;
	let emptyLines = 0;
	let startTime: number | null = null;
	let endTime: number | null = null;

	for (const line of lyric.lyricLines) {
		if (line.words.length === 0) emptyLines += 1;
		if (line.isBG) backgroundLines += 1;
		if (line.isDuet) duetLines += 1;
		if (isTimed(line.startTime, line.endTime)) {
			timedLines += 1;
			startTime =
				startTime === null ? line.startTime : Math.min(startTime, line.startTime);
			endTime = endTime === null ? line.endTime : Math.max(endTime, line.endTime);
		}
		for (const word of line.words) {
			words += 1;
			if (isTimed(word.startTime, word.endTime)) timedWords += 1;
		}
	}

	const lines = lyric.lyricLines.length;
	return {
		lines,
		words,
		timedLines,
		untimedLines: lines - timedLines,
		timedWords,
		untimedWords: words - timedWords,
		backgroundLines,
		duetLines,
		emptyLines,
		sections: lyric.sections?.length ?? 0,
		marks: lyric.marks?.length ?? 0,
		startTime,
		endTime,
		lineCoverage: lines === 0 ? 0 : (timedLines / lines) * 100,
		wordCoverage: words === 0 ? 0 : (timedWords / words) * 100,
	};
}

export function formatSummaryTime(ms: number | null) {
	if (ms === null || !Number.isFinite(ms)) return "—";
	const safe = Math.max(0, ms);
	const minutes = Math.floor(safe / 60000);
	const seconds = Math.floor((safe % 60000) / 1000);
	const millis = Math.floor(safe % 1000);
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

const percent = (value: number) => `${value.toFixed(1)}%`;

function sectionRange(lines: LyricLine[]) {
	const timed = lines.filter((line) => isTimed(line.startTime, line.endTime));
	if (timed.length === 0) return "—";
	const start = Math.min(...timed.map((line) => line.startTime));
	const end = Math.max(...timed.map((line) => line.endTime));
	return `${formatSummaryTime(start)} – ${formatSummaryTime(end)}`;
}

export function buildHandoffSummary(input: HandoffSummaryInput) {
	const { lyric, fileName, audioFileName, syncTimeOffset = 0 } = input;
	const generatedAt = input.generatedAt ?? new Date();
	const identity = identifyProject(lyric);
	const stats = getHandoffStats(lyric);
	const songInfo = lyric.songInfo;

	const meta = (key: string) =>
		lyric.metadata
			.find((item) => item.key.toLowerCase() === key.toLowerCase())
			?.value.filter(Boolean)
			.join(", ") ?? "";

	const title = identity.name || meta("musicName") || "Untitled Project";
	const artist = identity.artist || meta("artists");
	const songwriters = meta("songwriter");
	const language = meta("language");

	const openItems: string[] = [];
	if (stats.lines === 0) openItems.push("No lyric lines yet.");
	if (stats.untimedLines > 0) {
		openItems.push(
			`${stats.untimedLines} of ${stats.lines} lines still need timing.`,
		);
	}
	if (stats.untimedWords > 0) {
		openItems.push(
			`${stats.untimedWords} of ${stats.words} words have no valid start and end time.`,
		);
	}
	if (stats.emptyLines > 0) {
		openItems.push(`${stats.emptyLines} lyric lines are empty.`);
	}
	if (!title || title === "Untitled Project") {
		openItems.push("Add the song title metadata.");
	}
	if (!artist) openItems.push("Add the artist metadata.");
	if (songInfo?.status && songInfo.status !== "ready") {
		openItems.push(`Project status is “${songInfo.status}”.`);
	}
	if (openItems.length === 0) {
		openItems.push("Nothing outstanding — timing and metadata look complete.");
	}

	const sectionRows = (lyric.sections ?? [])
		.map((section) => {
			const lines = lyric.lyricLines.filter(
				(line) => line.sectionId === section.id,
			);
			if (lines.length === 0) return null;
			return `| ${section.label || section.category} | ${lines.length} | ${sectionRange(lines)} |`;
		})
		.filter(Boolean);

	const lines = [
		"# Hand-off summary",
		"",
		`**${title}${artist ? ` — ${artist}` : ""}**`,
		"",
		`Generated ${generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC with TTML Tool.`,
		"",
		"## Project",
		"",
		`- File: \`${fileName || "unnamed.ttml"}\``,
		`- Audio: ${audioFileName ? `\`${audioFileName}\`` : "not loaded"}`,
		`- Status: ${songInfo?.status ?? "not set"}`,
		`- Version timed: ${songInfo?.versionTimed || "not set"}`,
		`- Input timing offset: ${syncTimeOffset > 0 ? "+" : ""}${syncTimeOffset} ms`,
		`- Language: ${language || "not set"}`,
		`- Songwriters: ${songwriters || "not set"}`,
		"",
		"## Timing",
		"",
		"| Metric | Value |",
		"| --- | --- |",
		`| Lines | ${stats.lines} (${stats.timedLines} timed, ${stats.untimedLines} untimed) |`,
		`| Words | ${stats.words} (${stats.timedWords} timed, ${stats.untimedWords} untimed) |`,
		`| Line coverage | ${percent(stats.lineCoverage)} |`,
		`| Word coverage | ${percent(stats.wordCoverage)} |`,
		`| Song span | ${formatSummaryTime(stats.startTime)} – ${formatSummaryTime(stats.endTime)} |`,
		`| Background / duet lines | ${stats.backgroundLines} / ${stats.duetLines} |`,
		`| Sections / marks | ${stats.sections} / ${stats.marks} |`,
		"",
	];

	if (sectionRows.length > 0) {
		lines.push(
			"## Sections",
			"",
			"| Section | Lines | Timed span |",
			"| --- | --- | --- |",
			...sectionRows,
			"",
		);
	}

	lines.push("## Open items", "");
	for (const item of openItems) lines.push(`- ${item}`);
	lines.push("");

	if (songInfo?.notes?.trim() || songInfo?.versionNotes?.trim()) {
		lines.push("## Notes", "");
		if (songInfo.versionNotes?.trim()) {
			lines.push(`Version notes: ${songInfo.versionNotes.trim()}`, "");
		}
		if (songInfo.notes?.trim()) {
			lines.push(songInfo.notes.trim(), "");
		}
	}

	if (songInfo?.links?.length) {
		lines.push("## Links", "");
		for (const link of songInfo.links) lines.push(`- ${link}`);
		lines.push("");
	}

	lines.push(
		"---",
		"",
		"Generated from the project as it is right now. Timings and lyrics change with further editing.",
	);

	return lines.join("\n");
}
