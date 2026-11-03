import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage } from "./chunk";

export type AiCheckProvider = "openai" | "ollama";

export interface AiCheckEndpointConfig {
	provider: AiCheckProvider;
	baseUrl: string;
	apiKey: string;
	model: string;
	ollamaUrl: string;
	ollamaModel: string;
}

const isTauriRuntime = () =>
	typeof window !== "undefined" &&
	Boolean(
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ ||
			(window as unknown as Record<string, unknown>).__TAURI__ ||
			import.meta.env.TAURI_ENV_PLATFORM,
	);

const trimUrl = (value: string) => value.trim().replace(/\/+$/, "");

const postJson = async (
	url: string,
	headers: Record<string, string>,
	body: string,
): Promise<string> => {
	if (isTauriRuntime()) {
		return invoke<string>("ai_check_request", { request: { url, headers, body } });
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
	}
	return text;
};

const extractOpenAiContent = (payload: unknown): string | null => {
	const choices = (payload as { choices?: unknown })?.choices;
	if (!Array.isArray(choices) || choices.length === 0) return null;
	const message = (choices[0] as { message?: { content?: unknown } })?.message;
	const content = message?.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const joined = content
			.map((part) =>
				part && typeof part === "object" && "text" in part
					? String((part as { text: unknown }).text)
					: "",
			)
			.join("");
		return joined || null;
	}
	return null;
};

const extractOllamaContent = (payload: unknown): string | null => {
	const message = (payload as { message?: { content?: unknown } })?.message;
	return typeof message?.content === "string" ? message.content : null;
};

/**
 * Sends one chat request to the configured provider and returns the raw text
 * answer. Runs through a Rust command inside Tauri so CORS never applies; in a
 * plain browser it falls back to fetch and reports the network error.
 */
export async function requestAiCheckReview(
	config: AiCheckEndpointConfig,
	messages: ChatMessage[],
	signal?: AbortSignal,
): Promise<string> {
	if (config.provider === "ollama") {
		const url = trimUrl(config.ollamaUrl);
		const model = config.ollamaModel.trim();
		if (!url || !model) {
			throw new Error("Configure the Ollama endpoint and model in Settings > AI Check first.");
		}
		if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
		const raw = await postJson(
			`${url}/api/chat`,
			{},
			JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } }),
		);
		let payload: unknown;
		try {
			payload = JSON.parse(raw);
		} catch {
			throw new Error("The Ollama endpoint returned a non-JSON response.");
		}
		const content = extractOllamaContent(payload);
		if (!content) throw new Error("Ollama returned no review text.");
		return content;
	}

	const baseUrl = trimUrl(config.baseUrl);
	const model = config.model.trim();
	if (!baseUrl || !model) {
		throw new Error(
			"Configure the API base URL and model in Settings > AI Check first.",
		);
	}

	const headers: Record<string, string> = {};
	const apiKey = config.apiKey.trim();
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

	if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
	const raw = await postJson(
		`${baseUrl}/chat/completions`,
		headers,
		JSON.stringify({
			model,
			messages,
			temperature: 0.2,
			stream: false,
		}),
	);
	let payload: unknown;
	try {
		payload = JSON.parse(raw);
	} catch {
		throw new Error("The API returned a non-JSON response.");
	}
	const content = extractOpenAiContent(payload);
	if (!content) throw new Error("The API returned no review text.");
	return content;
}

const isLocalEndpoint = (value: string) => {
	try {
		const host = new URL(value).hostname;
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host === "::1" ||
			host === "0.0.0.0"
		);
	} catch {
		return false;
	}
};

/**
 * A remote OpenAI-compatible endpoint needs a key; local servers often do not,
 * so an empty key is allowed when the URL points at the same machine.
 */
export const isAiCheckConfigured = (config: AiCheckEndpointConfig): boolean =>
	config.provider === "ollama"
		? Boolean(config.ollamaUrl.trim() && config.ollamaModel.trim())
		: Boolean(
				config.baseUrl.trim() &&
					config.model.trim() &&
					(config.apiKey.trim() || isLocalEndpoint(config.baseUrl)),
			);