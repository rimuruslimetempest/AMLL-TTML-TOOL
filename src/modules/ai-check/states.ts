import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { AiCheckProvider } from "./ai-client";
import type { AiCheckIssue } from "./types";

const storedApiKeyAtom = atomWithStorage("aiCheckApiKey", "");
const sessionApiKeyAtom = atom("");

export const aiCheckPersistKeyAtom = atomWithStorage("aiCheckPersistKey", false);

export const aiCheckApiKeyAtom = atom(
	(get) =>
		get(aiCheckPersistKeyAtom)
			? get(storedApiKeyAtom)
			: get(sessionApiKeyAtom),
	(get, set, value: string) => {
		set(sessionApiKeyAtom, value);
		if (get(aiCheckPersistKeyAtom)) set(storedApiKeyAtom, value);
	},
);

export const clearStoredAiCheckApiKeyAtom = atom(null, (_get, set) => {
	set(storedApiKeyAtom, "");
});

export const aiCheckProviderAtom = atomWithStorage<AiCheckProvider>(
	"aiCheckProvider",
	"openai",
);
export const aiCheckBaseUrlAtom = atomWithStorage(
	"aiCheckBaseUrl",
	"https://api.openai.com/v1",
);
export const aiCheckModelAtom = atomWithStorage("aiCheckModel", "gpt-4o-mini");
export const aiCheckOllamaUrlAtom = atomWithStorage(
	"aiCheckOllamaUrl",
	"http://localhost:11434",
);
export const aiCheckOllamaModelAtom = atomWithStorage(
	"aiCheckOllamaModel",
	"llama3.1",
);

export type AiCheckStatus =
	| "idle"
	| "running-local"
	| "running-ai"
	| "done"
	| "error";

export const aiCheckPanelOpenAtom = atom(false);
export const aiCheckStatusAtom = atom<AiCheckStatus>("idle");
export const aiCheckIssuesAtom = atom<AiCheckIssue[]>([]);
export const aiCheckErrorAtom = atom<string | null>(null);
export const aiCheckIgnoredIdsAtom = atom<Set<string>>(new Set<string>());
export const aiCheckLastRunAtom = atom<number | null>(null);