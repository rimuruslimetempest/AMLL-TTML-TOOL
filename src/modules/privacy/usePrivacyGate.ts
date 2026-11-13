import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { PrivacyFeature } from "./constants";
import { hasFeatureConsent } from "./consent";
import { privacyConsentAtom, privacyPromptAtom } from "./states";

export function usePrivacyGate() {
	const consent = useAtomValue(privacyConsentAtom);
	const setPrompt = useSetAtom(privacyPromptAtom);

	return useCallback(
		(feature: PrivacyFeature, action: () => void, reason?: string) => {
			if (hasFeatureConsent(consent, feature)) {
				action();
				return;
			}
			setPrompt({ feature, action, reason });
		},
		[consent, setPrompt],
	);
}
