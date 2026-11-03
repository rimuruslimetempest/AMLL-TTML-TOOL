import { describe, expect, it } from "vitest";
import {
	AiCheckParseError,
	buildAiCheckMessages,
	parseAiIssueResponse,
	splitTtmlIntoChunks,
} from "./chunk";

const buildTtml = (lineCount: number) =>
	`<tt xmlns="http://www.w3.org/ns/ttml"><body>${Array.from(
		{ length: lineCount },
		(_, index) => `<p begin="0s" end="1s">line ${index + 1}</p>`,
	).join("")}</body></tt>`;

describe("splitTtmlIntoChunks", () => {
	it("splits long songs with a two line overlap", () => {
		const chunks = splitTtmlIntoChunks(buildTtml(90));
		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 40 });
		expect(chunks[1]).toMatchObject({ startLine: 39, endLine: 78 });
		expect(chunks[2]).toMatchObject({ startLine: 77, endLine: 90 });
		expect(chunks[0].text).toContain("[line 1]");
		expect(chunks[1].text).toContain("[line 39]");
	});

	it("keeps a short song in one chunk", () => {
		const chunks = splitTtmlIntoChunks(buildTtml(6));
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 6 });
	});

	it("falls back to the whole document when no paragraphs exist", () => {
		const chunks = splitTtmlIntoChunks("<tt></tt>");
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toBe("<tt></tt>");
	});
});

describe("buildAiCheckMessages", () => {
	it("includes the chunk and local findings", () => {
		const messages = buildAiCheckMessages(
			{ startLine: 1, endLine: 2, text: "[line 1] <p>x</p>" },
			[
				{
					id: "1",
					line: 1,
					severity: "warning",
					type: "timing",
					message: "Gap of 2000 ms",
					source: "local",
				},
			],
		);
		expect(messages[0].role).toBe("system");
		expect(messages[0].content).toContain("JSON array");
		expect(messages[1].content).toContain("[line 1] <p>x</p>");
		expect(messages[1].content).toContain("Gap of 2000 ms");
	});
});

describe("parseAiIssueResponse", () => {
	it("strips code fences and validates findings", () => {
		const issues = parseAiIssueResponse(
			'```json\n[{"line": 2, "syllableIndex": 1, "severity": "error", "type": "text", "message": "Typo", "suggestedFix": "Fix it"}]\n```',
			10,
		);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			line: 2,
			syllableIndex: 1,
			severity: "error",
			type: "text",
			message: "Typo",
			suggestedFix: "Fix it",
			source: "ai",
		});
	});

	it("defaults unknown severity and drops invalid or duplicate rows", () => {
		const issues = parseAiIssueResponse(
			JSON.stringify([
				{ line: 1, severity: "catastrophic", type: "timing", message: "Same" },
				{ line: 1, severity: "error", type: "timing", message: "Same" },
				{ line: 999, severity: "error", type: "timing", message: "Out of range" },
				{ line: 0, message: "No line" },
			]),
			5,
		);
		expect(issues).toHaveLength(1);
		expect(issues[0].severity).toBe("warning");
	});

	it("throws a friendly error for non-JSON answers", () => {
		expect(() => parseAiIssueResponse("I found nothing.", 5)).toThrow(
			AiCheckParseError,
		);
		expect(() => parseAiIssueResponse("[not json]", 5)).toThrow(
			/not valid JSON/,
		);
	});

	it("accepts an empty array", () => {
		expect(parseAiIssueResponse("[]", 5)).toEqual([]);
	});
});