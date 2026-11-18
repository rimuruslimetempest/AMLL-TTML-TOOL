import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Settings that only exist after someone has actually used an older build.
// Update-check keys and the setup keys are deliberately excluded because a
// fresh install writes them before the wizard mounts.
const LEGACY_USER_STORAGE_KEYS = new Set([
	"whatsNewSeenVersion",
	"ttmlCollabName",
	"language",
	"keepPlayingWordInView",
	"layoutMode",
	"uiDensity",
	"uiScale",
	"autosaveEnabled",
	"autosaveInterval",
	"autosaveLimit",
	"showTranslationLines",
	"showRomanLines",
	"hideObsceneWords",
	"syncJudgeMode",
	"wrapLyricLines",
	"highlightUnsyncedWordsInEditor",
	"discordRichPresenceEnabled",
	"customBackgroundImage",
	"appFont",
	"editorFont",
	"previewFont",
	"uiLayer",
	"performanceMode",
]);

/**
 * Detects a profile carried over from a version released before the setup
 * wizard. Existing users should never be walked through first-run setup.
 */
export function hasLegacyAppData(): boolean {
	if (typeof localStorage === "undefined") return false;
	try {
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key) continue;
			if (key.startsWith("keybindings:") || LEGACY_USER_STORAGE_KEYS.has(key)) {
				return true;
			}
		}
	} catch {
		// Restricted storage should not block the app on onboarding.
	}
	return false;
}

export const setupCompletedAtom = atomWithStorage(
	"ttmlSetupCompleted",
	false,
	undefined,
	{ getOnInit: true },
);
export const setupWizardOpenAtom = atom(false);
export const setupOutputDeviceAtom = atomWithStorage(
	"ttmlSetupOutputDevice",
	"",
	undefined,
	{ getOnInit: true },
);
