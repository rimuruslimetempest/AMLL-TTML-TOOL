export const PRIVACY_POLICY_VERSION = "2026-11-19";
export const TERMS_VERSION = "2026-11-19";
export const PRIVACY_POLICY_UPDATED = "November 19, 2026";

export const PRIVACY_CONSENT_STORAGE_KEY = "amll_privacy_consent";
export const DIAGNOSTICS_OPT_IN_STORAGE_KEY = "amll_diagnostics_opt_in";

export type PrivacyFeature = "cloud" | "live";

export const PRIVACY_FEATURE_LABEL: Record<PrivacyFeature, string> = {
	cloud: "Cloud account and library",
	live: "Live collaboration rooms",
};
