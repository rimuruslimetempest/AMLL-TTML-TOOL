import { useStore } from "jotai";
import { useCallback, useRef } from "react";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import exportTTMLText, {
	hasExportableLineContent,
} from "$/modules/project/logic/ttml-writer";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { requestAiCheckReview, isAiCheckConfigured } from "./ai-client";
import {
	AI_CHECK_CHUNK_LINES,
	AI_CHECK_CHUNK_OVERLAP,
	buildAiCheckMessages,
	countTtmlParagraphs,
	parseAiIssueResponse,
	splitTtmlIntoChunks,
} from "./chunk";
import { runLocalChecks } from "./local-checks";
import {
	aiCheckApiKeyAtom,
	aiCheckBaseUrlAtom,
	aiCheckErrorAtom,
	aiCheckIssuesAtom,
	aiCheckLastRunAtom,
	aiCheckModelAtom,
	aiCheckOllamaModelAtom,
	aiCheckOllamaUrlAtom,
	aiCheckPanelOpenAtom,
	aiCheckProviderAtom,
	aiCheckStatusAtom,
} from "./states";
import { AI_CHECK_SCROLL_EVENT, type AiCheckIssue } from "./types";

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const dedupeIssues = (issues: AiCheckIssue[]) => {
	const seen = new Set<string>();
	return issues.filter((issue) => {
		const key = `${issue.line}:${issue.syllableIndex ?? "-"}:${issue.type}:${issue.message.toLowerCase()}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const goToIssue = (issue: AiCheckIssue, store: ReturnType<typeof useStore>) => {
	const rawIndex = issue.lineIndex ?? issue.line - 1;
	const line = store.get(lyricLinesAtom).lyricLines[rawIndex];
	if (!line) return;
	store.set(selectedLinesAtom, new Set([line.id]));
	const word =
		issue.syllableIndex !== undefined
			? line.words[issue.syllableIndex]
			: undefined;
	store.set(selectedWordsAtom, word ? new Set([word.id]) : new Set<string>());
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent<number>(AI_CHECK_SCROLL_EVENT, {
				detail: rawIndex,
			}),
		);
	}
};

/** Applies a structured fix and reports whether anything changed. */
export const applyIssueFix = (
	issue: AiCheckIssue,
	store: ReturnType<typeof useStore>,
): boolean => {
	if (!issue.fix || issue.syllableIndex === undefined) return false;
	const lyric = store.get(lyricLinesAtom);
	const rawIndex = issue.lineIndex ?? issue.line - 1;
	const line = lyric.lyricLines[rawIndex];
	const word = line?.words[issue.syllableIndex];
	if (!line || !word) return false;
	if (word.word === issue.fix.text) return false;

	store.set(lyricLinesAtom, {
		...lyric,
		lyricLines: lyric.lyricLines.map((candidate, lineIndex) =>
			lineIndex !== rawIndex
				? candidate
				: {
						...candidate,
						words: candidate.words.map((candidateWord, wordIndex) =>
							wordIndex === issue.syllableIndex
								? { ...candidateWord, word: issue.fix?.text ?? candidateWord.word }
								: candidateWord,
						),
					},
		),
	});
	return true;
};

export const useRunAiCheck = () => {
	const store = useStore();
	const abortRef = useRef<AbortController | null>(null);

	const run = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		store.set(aiCheckPanelOpenAtom, true);
		store.set(aiCheckErrorAtom, null);
		store.set(aiCheckStatusAtom, "running-local");

		const lyric = store.get(lyricLinesAtom);
		if (lyric.lyricLines.length === 0) {
			store.set(aiCheckIssuesAtom, []);
			store.set(aiCheckErrorAtom, "There are no lyric lines to check yet.");
			store.set(aiCheckStatusAtom, "error");
			return;
		}

		const ttml = exportTTMLText(lyric);
		const localIssues = runLocalChecks(lyric, ttml);
		store.set(aiCheckIssuesAtom, localIssues);
		store.set(aiCheckStatusAtom, "running-ai");

		const displayNumbers = getLineDisplayNumbers(lyric.lyricLines);
		const paragraphLineIndices = lyric.lyricLines
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => !line.isBG && hasExportableLineContent(line))
			.map(({ index }) => index);
		const mappingValid =
			paragraphLineIndices.length === countTtmlParagraphs(ttml);

		const config = {
			provider: store.get(aiCheckProviderAtom),
			baseUrl: store.get(aiCheckBaseUrlAtom),
			apiKey: store.get(aiCheckApiKeyAtom),
			model: store.get(aiCheckModelAtom),
			ollamaUrl: store.get(aiCheckOllamaUrlAtom),
			ollamaModel: store.get(aiCheckOllamaModelAtom),
		};

		if (!isAiCheckConfigured(config)) {
			store.set(
				aiCheckErrorAtom,
				"AI review is not configured, so only local checks ran. Add a provider in Settings > AI Check for the deeper pass.",
			);
			store.set(aiCheckStatusAtom, "done");
			store.set(aiCheckLastRunAtom, Date.now());
			return;
		}

		const chunks = splitTtmlIntoChunks(
			ttml,
			AI_CHECK_CHUNK_LINES,
			AI_CHECK_CHUNK_OVERLAP,
		);
		const aiIssues: AiCheckIssue[] = [];
		const failures: string[] = [];

		for (const chunk of chunks) {
			if (controller.signal.aborted) return;
			try {
				const raw = await requestAiCheckReview(
					config,
					buildAiCheckMessages(
						chunk,
						localIssues.filter(
							(issue) =>
								issue.line >= chunk.startLine && issue.line <= chunk.endLine,
						),
					),
				);
				if (controller.signal.aborted) return;
				const parsed = parseAiIssueResponse(
					raw,
					mappingValid
						? paragraphLineIndices.length
						: lyric.lyricLines.length,
				);
				if (mappingValid) {
					for (const issue of parsed) {
						const rawLineIndex = paragraphLineIndices[issue.line - 1];
						if (rawLineIndex === undefined) continue;
						issue.lineIndex = rawLineIndex;
						issue.line = displayNumbers[rawLineIndex] ?? issue.line;
					}
				}
				aiIssues.push(...parsed);
			} catch (error) {
				if (controller.signal.aborted) return;
				failures.push(errorMessage(error));
			}
		}

		store.set(aiCheckIssuesAtom, dedupeIssues([...localIssues, ...aiIssues]));
		store.set(aiCheckLastRunAtom, Date.now());
		if (failures.length > 0) {
			store.set(
				aiCheckErrorAtom,
				aiIssues.length > 0
					? `Some chunks could not be reviewed: ${failures[0]}`
					: failures[0],
			);
			store.set(aiCheckStatusAtom, aiIssues.length > 0 ? "done" : "error");
			return;
		}

		store.set(aiCheckStatusAtom, "done");
	}, [store]);

	const cancel = useCallback(() => {
		abortRef.current?.abort();
		store.set(aiCheckStatusAtom, "idle");
	}, [store]);

	return { run, cancel };
};