import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	CloudTTMLMetadata,
	FirebaseProjectConfig,
	UserProfile,
} from "../types";

// Cloud features are disabled until the build supplies its own Firebase
// project. See .env.example for the VITE_FIREBASE_* variables.
export const DEFAULT_FIREBASE_CONFIG: FirebaseProjectConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
	appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const customFirebaseConfigAtom = atomWithStorage<FirebaseProjectConfig>(
	"amll-ttml-firebase-config",
	DEFAULT_FIREBASE_CONFIG,
);

export const currentUserAtom = atomWithStorage<UserProfile | null>(
	"amll-ttml-user-profile",
	null,
);
export const authLoadingAtom = atom<boolean>(false);

export const cloudFileManagerOpenAtom = atom<boolean>(false);
export const cloudFileManagerInitialTabAtom = atom<"save" | "open">("open");

export const cloudTTMLListAtom = atom<CloudTTMLMetadata[]>([]);
export const cloudTTMLLoadingAtom = atom<boolean>(false);
