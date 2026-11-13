import { describe, expect, it } from "vitest";
import {
	acceptFeatureConsent,
	hasFeatureConsent,
	isConsentCurrent,
} from "./consent";
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from "./constants";

describe("privacy consent", () => {
	it("grants only the feature the user accepted", () => {
		const record = acceptFeatureConsent(
			null,
			"live",
			new Date("2026-11-05T00:00:00.000Z"),
		);

		expect(hasFeatureConsent(record, "live")).toBe(true);
		expect(hasFeatureConsent(record, "cloud")).toBe(false);
		expect(record.policyVersion).toBe(PRIVACY_POLICY_VERSION);
		expect(record.termsVersion).toBe(TERMS_VERSION);
		expect(record.features.live?.acceptedAt).toBe(
			"2026-11-05T00:00:00.000Z",
		);
	});

	it("preserves an earlier feature when accepting another one", () => {
		const live = acceptFeatureConsent(null, "live");
		const both = acceptFeatureConsent(live, "cloud");

		expect(hasFeatureConsent(both, "live")).toBe(true);
		expect(hasFeatureConsent(both, "cloud")).toBe(true);
	});

	it("requires a new decision after a policy version change", () => {
		const record = acceptFeatureConsent(null, "cloud");
		const stale = { ...record, policyVersion: "2026-01-01" };

		expect(isConsentCurrent(stale)).toBe(false);
		expect(hasFeatureConsent(stale, "cloud")).toBe(false);

		const renewed = acceptFeatureConsent(stale, "cloud");
		expect(renewed.policyVersion).toBe(PRIVACY_POLICY_VERSION);
		expect(renewed.termsVersion).toBe(TERMS_VERSION);
		expect(hasFeatureConsent(renewed, "cloud")).toBe(true);
		expect(hasFeatureConsent(renewed, "live")).toBe(false);
	});
});
