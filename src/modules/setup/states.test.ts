import { afterEach, describe, expect, it, vi } from "vitest";
import { hasLegacyAppData } from "./states";

function stubStorage(entries: Record<string, string>) {
	const values = new Map(Object.entries(entries));
	vi.stubGlobal("localStorage", {
		get length() {
			return values.size;
		},
		key: (index: number) => Array.from(values.keys())[index] ?? null,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
		clear: () => {
			values.clear();
		},
	});
}

describe("hasLegacyAppData", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("ignores keys written by a fresh install", () => {
		stubStorage({
			ttmlSetupCompleted: "true",
			appUpdateLastCheck: "1",
			beginnerGuideStatus: "dismissed",
		});

		expect(hasLegacyAppData()).toBe(false);
	});

	it("detects settings left by an older build", () => {
		stubStorage({
			whatsNewSeenVersion: "5.1.1",
		});

		expect(hasLegacyAppData()).toBe(true);
	});

	it("detects legacy keybindings", () => {
		stubStorage({
			"keybindings:syncStart": '["KeyJ"]',
		});

		expect(hasLegacyAppData()).toBe(true);
	});
});
