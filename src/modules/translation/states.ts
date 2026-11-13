import { atomWithStorage } from "jotai/utils";

export const translationLanguageAtom = atomWithStorage(
	"ttmlTranslationLanguage",
	"",
);
export const romanizationLanguageAtom = atomWithStorage(
	"ttmlRomanizationLanguage",
	"",
);
