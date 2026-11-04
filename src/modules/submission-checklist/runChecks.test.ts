import { afterEach, describe, expect, it, vi } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	createDefaultSubmissionChecklistState,
	loadSubmissionChecklistState,
	saveSubmissionChecklistState,
} from "./projectState";
import {
	formatBlockingSummary,
	formatSubmissionMessage,
	formatSubmissionSummary,
	runSubmissionChecks,
} from "./runChecks";

const project = (): TTMLLyric => {
	const empty = newLyricLine();
	const filled = {
		...newLyricLine(),
		startTime: 1000,
		endTime: 2000,
		words: [
			{
				...newLyricWord(),
				word: "Hello",
				startTime: 1000,
				endTime: 2000,
			},
		],
	};
	return {
		metadata: [{ key: "songwriter", value: ["A Writer"] }],
		lyricLines: [empty, filled],
	};
};

describe("runSubmissionChecks", () => {
	it("collects issues and produces a summary", () => {
		const result = runSubmissionChecks(project());
		expect(result.issues.some((issue) => issue.ruleId === "empty-lines")).toBe(
			true,
		);
		expect(result.blockedCount).toBeGreaterThan(0);
		expect(formatSubmissionSummary(result)).toContain("required issue");
		expect(formatBlockingSummary(result)).toContain("required issue");
	});

	it("groups repeated whitespace findings and exposes every affected line", () => {
		const makeLine = (text: string, startTime: number) => ({
			...newLyricLine(),
			startTime,
			endTime: startTime + 1000,
			words: [
				{
					...newLyricWord(),
					word: text,
					startTime,
					endTime: startTime + 1000,
				},
			],
		});
		const result = runSubmissionChecks({
			metadata: [{ key: "songwriter", value: ["A Writer"] }],
			lyricLines: [makeLine("hello", 1000), makeLine("another line", 2000)],
		});
		const whitespace = result.issues.filter(
			(issue) => issue.ruleId === "text-whitespace-capitalization",
		);
		expect(whitespace).toHaveLength(1);
		expect(whitespace[0]?.lines).toEqual([1, 2]);
	});

	it("honors a per-project dismissed issue id", () => {
		const first = runSubmissionChecks(project());
		const emptyIssue = first.issues.find(
			(issue) => issue.ruleId === "empty-lines",
		);
		if (!emptyIssue) throw new Error("Expected an empty-line issue");

		const second = runSubmissionChecks(project(), {
			dismissedIssueIds: [emptyIssue.id],
		});
		expect(second.issues.some((issue) => issue.ruleId === "empty-lines")).toBe(
			false,
		);
		expect(second.dismissedCount).toBeGreaterThan(0);
	});

	it("formats the copyable submission message", () => {
		const result = runSubmissionChecks(project());
		const message = formatSubmissionMessage(result, {
			songLinks: "https://open.spotify.com/track/abc",
			versionNotes: "Clean edit",
			spotifyIds: "abc",
		});
		expect(message).toContain(
			"Song link(s): https://open.spotify.com/track/abc",
		);
		expect(message).toContain("Version notes: Clean edit");
		expect(message).toContain("Checklist: ");
	});
});

describe("submission checklist project state", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("round-trips manual checks, dismissals, info, and route", () => {
		const storage = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		});

		const state = createDefaultSubmissionChecklistState();
		state.manualChecks["local-test"] = true;
		state.dismissedIssueIds.push("submission:held-letters:1:2:detail");
		state.info.songLinks = "https://example.com/song";
		state.info.versionNotes = "Explicit";
		state.info.spotifyIds = "spotify-id";
		state.route = "maker";

		saveSubmissionChecklistState("project-1", state);
		expect(loadSubmissionChecklistState("project-1")).toEqual(state);
		expect(loadSubmissionChecklistState("project-2")).toEqual(
			createDefaultSubmissionChecklistState(),
		);
	});

	it("falls back safely when storage is missing or malformed", () => {
		expect(loadSubmissionChecklistState("missing")).toEqual(
			createDefaultSubmissionChecklistState(),
		);

		const storage = new Map<string, string>([
			["amll-submission-checklist:bad", "{not json"],
			[
				"amll-submission-checklist:partial",
				JSON.stringify({
					route: "unknown",
					manualChecks: { a: true, b: false },
				}),
			],
		]);
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		});

		expect(loadSubmissionChecklistState("bad")).toEqual(
			createDefaultSubmissionChecklistState(),
		);
		const partial = loadSubmissionChecklistState("partial");
		expect(partial.route).toBe("no-role");
		expect(partial.manualChecks).toEqual({ a: true });
	});
});
