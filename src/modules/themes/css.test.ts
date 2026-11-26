import { describe, expect, it } from "vitest";
import {
	findGlobalThemeSelectors,
	sanitizeThemeCss,
	scopeNewUiCss,
} from "./css";

describe("theme CSS safety", () => {
	it("removes imports, script-like markup, and unsafe protocols", () => {
		const result = sanitizeThemeCss(
			'@import url("https://example.com/theme.css");\nbody { color: red; background: url(javascript:alert(1)); }\n<script>alert(1)</script>',
		);
		expect(result.blockedRemoteImports).toBe(true);
		expect(result.css).not.toContain("@import");
		expect(result.css).not.toContain("<script");
		expect(result.css).not.toContain("javascript:");
	});

	it("blocks remote urls unless the user opts in", () => {
		const blocked = sanitizeThemeCss(
			'.lyrics { background-image: url("https://example.com/a.png"); }',
		);
		expect(blocked.blockedRemoteUrls).toBe(true);
		expect(blocked.css).toContain('url("")');

		const allowed = sanitizeThemeCss(
			'.lyrics { background-image: url("https://example.com/a.png"); }',
			{ allowRemote: true },
		);
		expect(allowed.blockedRemoteUrls).toBe(false);
		expect(allowed.css).toContain("https://example.com/a.png");
	});

	it("keeps local Tauri asset urls", () => {
		const result = sanitizeThemeCss(
			'.lyrics { background-image: url("asset://localhost/a.png"); }',
		);
		expect(result.blockedRemoteUrls).toBe(false);
		expect(result.css).toContain("asset://localhost/a.png");
	});

	it("scopes user CSS to the New interface", () => {
		expect(scopeNewUiCss(".lyrics { color: red; }")).toBe(
			'@scope (html[data-ui-layer="new"]) {\n.lyrics { color: red; }\n}',
		);
	});

	it("finds selectors that can repaint the shell or headings", () => {
		const selectors = findGlobalThemeSelectors(
			"body { background: red; } h2, .lyrics { color: blue; } .safe { color: green; }",
		);
		expect(selectors).toContain("body");
		expect(selectors.some((selector) => selector.includes("h2"))).toBe(true);
		expect(selectors).not.toContain(".safe");
	});
});
