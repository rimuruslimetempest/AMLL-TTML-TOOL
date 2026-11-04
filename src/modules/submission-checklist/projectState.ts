import { SUBMISSION_ROUTES } from "./submissionRules";
import type {
	SubmissionChecklistProjectState,
	SubmissionInfo,
	SubmissionRouteId,
} from "./types";

const STORAGE_PREFIX = "amll-submission-checklist";
const STATE_VERSION = 1 as const;

const emptyInfo = (): SubmissionInfo => ({
	songLinks: "",
	versionNotes: "",
	spotifyIds: "",
});

export const createDefaultSubmissionChecklistState =
	(): SubmissionChecklistProjectState => ({
		version: STATE_VERSION,
		manualChecks: {},
		dismissedIssueIds: [],
		info: emptyInfo(),
		route: "no-role",
	});

const storageKey = (projectId: string) =>
	`${STORAGE_PREFIX}:${encodeURIComponent(projectId)}`;

const isRouteId = (value: unknown): value is SubmissionRouteId =>
	SUBMISSION_ROUTES.some((route) => route.id === value);

const asString = (value: unknown): string =>
	typeof value === "string" ? value : "";

/**
 * localStorage can contain older or partially-written data. Normalize it so a
 * stale value can never crash the panel or change a rule's meaning.
 */
function normalizeState(value: unknown): SubmissionChecklistProjectState {
	const fallback = createDefaultSubmissionChecklistState();
	if (typeof value !== "object" || value === null) return fallback;

	const record = value as Record<string, unknown>;
	const manualChecks: Record<string, boolean> = {};
	if (typeof record.manualChecks === "object" && record.manualChecks !== null) {
		for (const [key, checked] of Object.entries(
			record.manualChecks as Record<string, unknown>,
		)) {
			if (checked === true) manualChecks[key] = true;
		}
	}

	const dismissedIssueIds = Array.isArray(record.dismissedIssueIds)
		? Array.from(
				new Set(
					record.dismissedIssueIds.filter(
						(id): id is string => typeof id === "string" && id.length > 0,
					),
				),
			)
		: [];

	const infoRecord =
		typeof record.info === "object" && record.info !== null
			? (record.info as Record<string, unknown>)
			: {};

	return {
		version: STATE_VERSION,
		manualChecks,
		dismissedIssueIds,
		info: {
			songLinks: asString(infoRecord.songLinks),
			versionNotes: asString(infoRecord.versionNotes),
			spotifyIds: asString(infoRecord.spotifyIds),
		},
		route: isRouteId(record.route) ? record.route : fallback.route,
	};
}

export function loadSubmissionChecklistState(
	projectId: string,
): SubmissionChecklistProjectState {
	if (typeof localStorage === "undefined") {
		return createDefaultSubmissionChecklistState();
	}
	try {
		const raw = localStorage.getItem(storageKey(projectId));
		if (!raw) return createDefaultSubmissionChecklistState();
		return normalizeState(JSON.parse(raw));
	} catch {
		return createDefaultSubmissionChecklistState();
	}
}

export function saveSubmissionChecklistState(
	projectId: string,
	state: SubmissionChecklistProjectState,
): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(storageKey(projectId), JSON.stringify(state));
	} catch {
		// A full or disabled localStorage must not break the editor.
	}
}
