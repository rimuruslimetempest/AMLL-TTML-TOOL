import { describe, expect, it } from "vitest";
import { resolvePluginRegistryUrl } from "./registry";

describe("resolvePluginRegistryUrl", () => {
	it("resolves marketplace-relative plugin paths", () => {
		expect(
			resolvePluginRegistryUrl("registry/plugins/example/plugin.wasm"),
		).toBe(
			"https://rimuruslimetempest.github.io/AMLL-TTML-TOOL/registry/plugins/example/plugin.wasm",
		);
	});

	it("keeps app-local paths untouched", () => {
		expect(resolvePluginRegistryUrl("/plugins/example.wasm")).toBe(
			"/plugins/example.wasm",
		);
	});

	it("accepts absolute HTTPS downloads", () => {
		expect(resolvePluginRegistryUrl("https://example.com/plugin.wasm")).toBe(
			"https://example.com/plugin.wasm",
		);
	});

	it("rejects plain HTTP downloads", () => {
		expect(() =>
			resolvePluginRegistryUrl("http://example.com/plugin.wasm"),
		).toThrow(/HTTPS/i);
	});
});
