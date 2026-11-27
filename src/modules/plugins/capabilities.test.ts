import { describe, expect, it } from "vitest";
import { detectPluginCapabilities } from "./capabilities";

describe("detectPluginCapabilities", () => {
	it("only offers a tool when the module exports run_tool", () => {
		expect(
			detectPluginCapabilities("tool", {
				run_tool: () => 0,
				run_importer: () => 0,
			}),
		).toEqual({ importer: false, exporter: false, tool: true });
		expect(detectPluginCapabilities("tool", { run_importer: () => 0 })).toEqual(
			{ importer: false, exporter: false, tool: false },
		);
	});

	it("only offers an importer for importer plugins with run_importer", () => {
		expect(
			detectPluginCapabilities("importer", { run_importer: () => 0 }),
		).toEqual({ importer: true, exporter: false, tool: false });
		expect(detectPluginCapabilities("importer", { run_tool: () => 0 })).toEqual(
			{ importer: false, exporter: false, tool: false },
		);
	});

	it("enables every exported operation for a both plugin", () => {
		expect(
			detectPluginCapabilities("both", {
				run_importer: () => 0,
				run_exporter: () => 0,
				run_tool: () => 0,
			}),
		).toEqual({ importer: true, exporter: true, tool: true });
	});
});
