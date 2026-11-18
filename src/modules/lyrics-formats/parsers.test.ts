import { describe, expect, it } from "vitest";
import { newLyricLine, type LyricLine } from "$/types/ttml";
import { exportLyrics, exportSrt } from "./exporters";
import { parsedResultToTTML } from "./import";
import { decodeLyricBytes, parseLyricText } from "./parsers";

const makeLine = (
	word: string,
	startTime: number,
	endTime: number,
	extra: Partial<LyricLine> = {},
): LyricLine => ({
	...newLyricLine(),
	startTime,
	endTime,
	words: [
		{
			id: `${word}-${startTime}`,
			word,
			startTime,
			endTime,
			obscene: false,
			romanWord: "",
		},
	],
	...extra,
});

describe("lyric format import", () => {
	it("parses LRC line timing and fills line ends", () => {
		const result = parseLyricText(
			"song.lrc",
			"[00:01.00]Hello\n[00:03.50]World",
		);
		expect(result.format).toBe("lrc");
		expect(result.lines).toHaveLength(2);
		expect(result.lines[0]).toMatchObject({
			text: "Hello",
			startTime: 1000,
			endTime: 3500,
		});
	});

	it("parses enhanced LRC word timing", () => {
		const result = parseLyricText(
			"song.lrc",
			"[00:01.00]<00:01.00>Hello <00:01.50>world",
		);
		expect(result.hasWordTiming).toBe(true);
		expect(result.lines[0].words).toHaveLength(2);
		expect(result.lines[0].words?.[1].startTime).toBe(1500);
	});

	it("parses SRT, ASS, VTT, and plain text", () => {
		const srt = parseLyricText(
			"sample.srt",
			"1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld",
		);
		expect(srt.lines.map((line) => line.text)).toEqual(["Hello", "World"]);
		expect(srt.lines[0].endTime).toBe(2500);

		const ass = parseLyricText(
			"sample.ass",
			"[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello {\\i1}world",
		);
		expect(ass.lines[0].text).toBe("Hello world");

		const vtt = parseLyricText(
			"sample.vtt",
			"WEBVTT\n\n00:01.000 --> 00:02.000\nHello",
		);
		expect(vtt.lines[0]).toMatchObject({ text: "Hello", startTime: 1000 });

		const plain = parseLyricText("sample.txt", "One\n\nTwo\nThree");
		expect(plain.lines).toHaveLength(3);
		expect(plain.lines[0].startTime).toBe(0);
	});

	it("decodes UTF-16LE with BOM without crashing", () => {
		const bytes = Uint8Array.from([
			0xff, 0xfe, 0x48, 0x00, 0x69, 0x00,
		]);
		const decoded = decodeLyricBytes(bytes.buffer);
		expect(decoded.encoding).toBe("UTF-16LE");
		expect(decoded.text).toBe("Hi");
	});

	it("marks every imported word for review", () => {
		const result = parseLyricText("sample.lrc", "[00:01.00]Hello");
		const ttml = parsedResultToTTML(result);
		expect(ttml.lyricLines[0].words[0].needsReview).toBe(true);
		expect(ttml.lyricLines[0].words).toHaveLength(1);
	});
});

describe("lyric format export", () => {
	const lyric = {
		metadata: [],
		lyricLines: [
			makeLine("Hello", 1000, 2000, { translatedLyric: "Bonjour" }),
			makeLine("World", 3000, 4000),
			makeLine("Background", 5000, 6000, { isBG: true }),
		],
	};

	it("exports LRC, SRT, and plain text", () => {
		const options = {
			includeTranslation: false,
			includeRomanization: false,
			includeBackground: true,
		};
		expect(exportLyrics(lyric, "lrc", options).content).toContain(
			"[00:01.00]Hello",
		);
		expect(exportSrt(lyric, options)).toContain(
			"00:00:01,000 --> 00:00:02,000",
		);
		expect(exportLyrics(lyric, "plain", options).content).toBe(
			"Hello\nWorld\nBackground",
		);
	});

	it("excludes background lines when requested and reports losses", () => {
		const result = exportLyrics(lyric, "srt", {
			includeTranslation: true,
			includeRomanization: false,
			includeBackground: false,
		});
		expect(result.content).not.toContain("Background");
		expect(result.losses.join(" ")).toContain("Per-word timing");
	});
});
