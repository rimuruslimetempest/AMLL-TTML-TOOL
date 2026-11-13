import * as Sentry from "@sentry/react";
import { globalStore } from "$/states/store";
import { isDiagnosticsOptIn } from "./consent";
import {
	crashReportEndpoint,
	makeCrashReport,
	saveCrashReport,
	sendCrashReport,
} from "./crash";
import { pendingCrashReportAtom } from "./states";

const dsn = String(import.meta.env.SENTRY_DSN || "").trim();
let initialized = false;

export const isDiagnosticsConfigured = (): boolean => Boolean(dsn);

export function syncDiagnosticsReporting(enabled: boolean): void {
	if (!enabled || !dsn) {
		if (initialized) {
			initialized = false;
			void Sentry.close(2000);
		}
		return;
	}
	if (initialized) return;

	Sentry.init({
		dsn,
		integrations: [],
		sendDefaultPii: false,
		tracesSampleRate: 0,
		beforeSend(event) {
			// Error reports are for crashes and stack traces, not user content.
			delete event.user;
			delete event.request;
			delete event.breadcrumbs;
			for (const key of Object.keys(event.extra || {})) {
				if (/lyric|ttml|audio|token|secret|key/i.test(key)) {
					delete event.extra?.[key];
				}
			}
			return event;
		},
	});
	initialized = true;
}

export function initializeStoredDiagnostics(): void {
	syncDiagnosticsReporting(isDiagnosticsOptIn());
}

export function captureDiagnosticException(
	error: unknown,
	context?: { componentStack?: string | null },
): void {
	// A content-free local report is written even before any opt-in, so the
	// one-time prompt can show exactly what would be sent. It is never sent
	// automatically and can be deleted from Settings or the prompt.
	const report = makeCrashReport(error, context?.componentStack);
	saveCrashReport(report);
	globalStore.set(pendingCrashReportAtom, report);
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("ttml:crash-report", { detail: report }),
		);
	}

	if (!initialized || !isDiagnosticsOptIn()) return;
	Sentry.captureException(error, {
		contexts: context?.componentStack
			? { react: { componentStack: context.componentStack.slice(0, 4000) } }
			: undefined,
	});
	const endpoint = crashReportEndpoint();
	if (endpoint) void sendCrashReport(report, endpoint);
}
