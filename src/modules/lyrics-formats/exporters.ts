import type { LyricLine, TTMLLyric } from "$/types/ttml";
import { formatSubtitleTimestamp, type LyricFormat } from "./parsers";

export interface LyricExportOptions {
	includeTranslation: boolean;
	includeRomanization: boolean;
	includeBackground: boolean;
}

export interface LyricExportResult {
	format: LyricFormat;
	formatLabel: string;
	extension: string;
	content: string;
	losses: string[];
}

const FORMAT_LABEL: Record<LyricFormat, string> = {
	lrc: "LRC (line timing)",
	eslrc: "Enhanced LRC (word timing)",
	srt: "SRT subtitles",
	plain: "Plain text",
	ass: "ASS/SSA",
	vtt: "WebVTT",
};

const FORMAT_EXTENSION: Record<LyricFormat, string> = {
	lrc: "lrc",
	eslrc: "lrc",
	srt: "srt",
	plain: "txt",
	ass: "ass",
	vtt: "vtt",
};

export function lyricLineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("").trim();
}

export function getExportLosses(
	format: LyricFormat,
	options: LyricExportOptions,
): string[] {
	const losses: string[] = [];
	switch (format) {
		case "lrc":
			losses.push("Per-word timing is not stored.");
			losses.push("Duet and background roles are not stored.");
			losses.push("TTML metadata, sections, and translation fields are not stored.");
			break;
		case "eslrc":
			losses.push("Duet and background roles are not stored.");
			losses.push("TTML metadata and sections are not stored.");
			break;
		case "srt":
			losses.push("Per-word timing is not stored.");
			losses.push("Duet and background roles are not stored.");
			losses.push("TTML metadata and sections are not stored.");
			break;
		case "ass":
			losses.push("Per-word timing is not stored.");
			losses.push("Styling is reset to a plain readable style.");
			losses.push("Duet and background roles are not stored.");
			break;
		case "vtt":
			losses.push("Per-word timing is not stored.");
			losses.push("Duet and background roles are not stored.");
			losses.push("TTML metadata and sections are not stored.");
			break;
		case "plain":
			losses.push("All timing is lost. Plain text is lyrics only.");
			losses.push("Duet and background roles are not stored.");
			losses.push("TTML metadata and sections are not stored.");
			break;
		default:
			losses.push("This format is not available in the general export dialog.");
	}
	if (!options.includeTranslation && format !== "plain")
		losses.push("Translation is excluded.");
	if (!options.includeRomanization && format !== "plain")
		losses.push("Romanization is excluded.");
	if (!options.includeBackground && format !== "plain")
		losses.push("Background vocal lines are excluded.");
	return losses;
}

function lineTextWithExtras(line: LyricLine, options: LyricExportOptions) {
	const parts = [lyricLineText(line)];
	if (options.includeTranslation && line.translatedLyric?.trim())
		parts.push(line.translatedLyric.trim());
	if (options.includeRomanization && line.romanLyric?.trim())
		parts.push(line.romanLyric.trim());
	return parts.filter(Boolean).join(" / ");
}

function lrcTimestamp(ms: number) {
	const safe = Math.max(0, Math.round(ms));
	const minutes = Math.floor(safe / 60_000);
	const seconds = Math.floor((safe % 60_000) / 1000);
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(Math.floor((safe % 1000) / 10)).padStart(2, "0")}`;
}

function selectedLines(lyric: TTMLLyric, options: LyricExportOptions) {
	return lyric.lyricLines.filter(
		(line) => options.includeBackground || !line.isBG,
	);
}

export function exportLrc(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	return selectedLines(lyric, options)
		.map(
			(line) =>
				`[${lrcTimestamp(line.startTime)}]${lineTextWithExtras(line, options)}`,
		)
		.filter((line) => line.replace(/^\[[^\]]*\]/, "").trim())
		.join("\n");
}

export function exportEnhancedLrc(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	return selectedLines(lyric, options)
		.map((line) => {
			const words = line.words
				.filter((word) => word.word.trim())
				.map((word, index) => {
					const time =
						index === 0 ? line.startTime : word.startTime;
					return `<${lrcTimestamp(time)}>${word.word}`;
				})
				.join("");
			const extras = [];
			if (options.includeTranslation && line.translatedLyric?.trim())
				extras.push(` / ${line.translatedLyric.trim()}`);
			if (options.includeRomanization && line.romanLyric?.trim())
				extras.push(` / ${line.romanLyric.trim()}`);
			return `[${lrcTimestamp(line.startTime)}]${words}${extras.join("")}`;
		})
		.filter((line) => line.replace(/^\[[^\]]*\]/, "").trim())
		.join("\n");
}

export function exportSrt(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	return selectedLines(lyric, options)
		.map((line, index) => {
			const parts = [lyricLineText(line)];
			if (options.includeTranslation && line.translatedLyric?.trim())
				parts.push(line.translatedLyric.trim());
			if (options.includeRomanization && line.romanLyric?.trim())
				parts.push(line.romanLyric.trim());
			return `${index + 1}\n${formatSubtitleTimestamp(line.startTime)} --> ${formatSubtitleTimestamp(line.endTime)}\n${parts.filter(Boolean).join("\n")}`;
		})
		.join("\n\n");
}

function assTimestamp(ms: number): string {
	const safe = Math.max(0, Math.round(ms));
	const hours = Math.floor(safe / 3_600_000);
	const minutes = Math.floor((safe % 3_600_000) / 60_000);
	const seconds = Math.floor((safe % 60_000) / 1000);
	const centis = Math.floor((safe % 1000) / 10);
	return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function vttTimestamp(ms: number): string {
	const safe = Math.max(0, Math.round(ms));
	const hours = Math.floor(safe / 3_600_000);
	const minutes = Math.floor((safe % 3_600_000) / 60_000);
	const seconds = Math.floor((safe % 60_000) / 1000);
	const millis = safe % 1000;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function exportAss(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	const header = [
		"[Script Info]",
		"ScriptType: v4.00+",
		"WrapStyle: 0",
		"ScaledBorderAndShadow: yes",
		"PlayResX: 1920",
		"PlayResY: 1080",
		"",
		"[V4+ Styles]",
		"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
		"Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3,0,2,80,80,70,1",
		"",
		"[Events]",
		"Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
	].join("\n");
	const events = selectedLines(lyric, options).map((line) => {
		const parts = [lyricLineText(line)];
		if (options.includeTranslation && line.translatedLyric?.trim())
			parts.push(line.translatedLyric.trim());
		if (options.includeRomanization && line.romanLyric?.trim())
			parts.push(line.romanLyric.trim());
		const text = parts
			.filter(Boolean)
			.join("\\N")
			.replace(/\{/g, "(")
			.replace(/\}/g, ")");
		return `Dialogue: 0,${assTimestamp(line.startTime)},${assTimestamp(
			line.endTime,
		)},Default,,0,0,0,,${text}`;
	});
	return `${header}\n${events.join("\n")}`;
}

export function exportVtt(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	const cues = selectedLines(lyric, options).map((line) => {
		const parts = [lyricLineText(line)];
		if (options.includeTranslation && line.translatedLyric?.trim())
			parts.push(line.translatedLyric.trim());
		if (options.includeRomanization && line.romanLyric?.trim())
			parts.push(line.romanLyric.trim());
		return `${vttTimestamp(line.startTime)} --> ${vttTimestamp(
			line.endTime,
		)}\n${parts.filter(Boolean).join("\n")}`;
	});
	return `WEBVTT\n\n${cues.join("\n\n")}`;
}

export function exportPlainText(
	lyric: TTMLLyric,
	options: LyricExportOptions,
): string {
	return selectedLines(lyric, options)
		.map((line) => lyricLineText(line))
		.filter(Boolean)
		.join("\n");
}

export function exportLyrics(
	lyric: TTMLLyric,
	format: LyricFormat,
	options: LyricExportOptions,
): LyricExportResult {
	let content = "";
	switch (format) {
		case "lrc":
			content = exportLrc(lyric, options);
			break;
		case "eslrc":
			content = exportEnhancedLrc(lyric, options);
			break;
		case "srt":
			content = exportSrt(lyric, options);
			break;
		case "ass":
			content = exportAss(lyric, options);
			break;
		case "vtt":
			content = exportVtt(lyric, options);
			break;
		case "plain":
			content = exportPlainText(lyric, options);
			break;
		default:
			content = "";
	}
	return {
		format,
		formatLabel: FORMAT_LABEL[format],
		extension: FORMAT_EXTENSION[format],
		content,
		losses: getExportLosses(format, options),
	};
}
