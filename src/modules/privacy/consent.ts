import {
	DIAGNOSTICS_OPT_IN_STORAGE_KEY,
	PRIVACY_CONSENT_STORAGE_KEY,
	PRIVACY_POLICY_VERSION,
	type PrivacyFeature,
	TERMS_VERSION,
} from "./constants";

export interface FeatureConsent {
	acceptedAt: string;
}

export interface PrivacyConsentRecord {
	policyVersion: string;
	termsVersion: string;
	acceptedAt: string;
	features: Partial<Record<PrivacyFeature, FeatureConsent>>;
}

const isFeature = (value: string): value is PrivacyFeature =>
	value === "cloud" || value === "live";

const parseConsent = (raw: string | null): PrivacyConsentRecord | null => {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<PrivacyConsentRecord> | null;
		if (
			!parsed ||
			typeof parsed !== "object" ||
			typeof parsed.policyVersion !== "string" ||
			typeof parsed.termsVersion !== "string" ||
			typeof parsed.acceptedAt !== "string" ||
			!parsed.features ||
			typeof parsed.features !== "object"
		) {
			return null;
		}
		const features: Partial<Record<PrivacyFeature, FeatureConsent>> = {};
		for (const [key, value] of Object.entries(parsed.features)) {
			if (
				isFeature(key) &&
				value &&
				typeof value === "object" &&
				typeof (value as FeatureConsent).acceptedAt === "string"
			) {
				features[key] = { acceptedAt: (value as FeatureConsent).acceptedAt };
			}
		}
		return {
			policyVersion: parsed.policyVersion,
			termsVersion: parsed.termsVersion,
			acceptedAt: parsed.acceptedAt,
			features,
		};
	} catch {
		return null;
	}
};

export const readConsentRecord = (): PrivacyConsentRecord | null => {
	if (typeof localStorage === "undefined") return null;
	try {
		return parseConsent(localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY));
	} catch {
		return null;
	}
};

export const writeConsentRecord = (record: PrivacyConsentRecord | null): void => {
	if (typeof localStorage === "undefined") return;
	try {
		if (record) {
			localStorage.setItem(
				PRIVACY_CONSENT_STORAGE_KEY,
				JSON.stringify(record),
			);
		} else {
			localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY);
		}
	} catch {
		// Private browsing or a locked-down webview may reject storage. The
		// in-memory Jotai atom still lets the current session proceed.
	}
};

export const isConsentCurrent = (
	record: PrivacyConsentRecord | null,
): record is PrivacyConsentRecord =>
	Boolean(
		record &&
			record.policyVersion === PRIVACY_POLICY_VERSION &&
			record.termsVersion === TERMS_VERSION,
	);

export const hasFeatureConsent = (
	record: PrivacyConsentRecord | null,
	feature: PrivacyFeature,
): boolean => isConsentCurrent(record) && Boolean(record.features[feature]);

export const hasStoredFeatureConsent = (feature: PrivacyFeature): boolean =>
	hasFeatureConsent(readConsentRecord(), feature);

export const acceptFeatureConsent = (
	current: PrivacyConsentRecord | null,
	feature: PrivacyFeature,
	now = new Date(),
): PrivacyConsentRecord => {
	const acceptedAt = now.toISOString();
	const base = isConsentCurrent(current)
		? current
		: {
				policyVersion: PRIVACY_POLICY_VERSION,
				termsVersion: TERMS_VERSION,
				acceptedAt,
				features: {},
			};
	return {
		...base,
		acceptedAt,
		features: {
			...base.features,
			[feature]: { acceptedAt },
		},
	};
};

export const isDiagnosticsOptIn = (): boolean => {
	if (typeof localStorage === "undefined") return false;
	try {
		return localStorage.getItem(DIAGNOSTICS_OPT_IN_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
};

export const setStoredDiagnosticsOptIn = (enabled: boolean): void => {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(DIAGNOSTICS_OPT_IN_STORAGE_KEY, String(enabled));
	} catch {
		// Ignore storage failures; diagnostics stays off in that case.
	}
};
