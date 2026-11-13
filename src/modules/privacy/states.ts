import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
	DIAGNOSTICS_OPT_IN_STORAGE_KEY,
	PRIVACY_CONSENT_STORAGE_KEY,
	type PrivacyFeature,
} from "./constants";
import type { PrivacyConsentRecord } from "./consent";
import type { CrashReport } from "./crash";

export interface PrivacyPrompt {
	feature: PrivacyFeature;
	reason?: string;
	action?: () => void;
}

export const privacyConsentAtom = atomWithStorage<PrivacyConsentRecord | null>(
	PRIVACY_CONSENT_STORAGE_KEY,
	null,
);

export const privacyPromptAtom = atom<PrivacyPrompt | null>(null);
export const privacyPolicyDialogAtom = atom(false);
export const termsDialogAtom = atom(false);

export const diagnosticsOptInAtom = atomWithStorage<boolean>(
	DIAGNOSTICS_OPT_IN_STORAGE_KEY,
	false,
);

/** Latest locally saved crash report, used to open the one-time prompt. */
export const pendingCrashReportAtom = atom<CrashReport | null>(null);
/** The plain-language crash prompt is shown at most once. */
export const crashPromptSeenAtom = atomWithStorage<boolean>(
	"amll_crash_prompt_seen",
	false,
);
