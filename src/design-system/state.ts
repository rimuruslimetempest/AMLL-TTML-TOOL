import { atom } from "jotai";

/**
 * True after the New interface boundary was forced back to Classic.
 * The banner is deliberately outside the inner boundary so it survives the
 * fallback switch and explains why the interface changed.
 */
export const uiFallbackNoticeAtom = atom(false);
