/**
 * Crash report payloads are deliberately small and content-free.
 *
 * They contain only what is needed to find a defect: time, app version,
 * platform, error message, stack trace, and React component stack. Lyrics,
 * project metadata, audio, file paths chosen by the user, names, room data,
 * and account data are never added. The report is kept on this device unless
 * the user explicitly opts in and a destination is configured.
 */

export interface CrashReport {
	version: 1;
	id: string;
	at: number;
	message: string;
	stack?: string;
	componentStack?: string;
	appVersion: string;
	platform: string;
}

export const LAST_CRASH_STORAGE_KEY = "amll_last_crash_report";

function trim(value: string | undefined, max: number): string | undefined {
	if (!value) return undefined;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function makeCrashReport(
	error: unknown,
	componentStack?: string | null,
): CrashReport {
	const normalized =
		error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
	const platform =
		typeof navigator !== "undefined" ? navigator.platform || "unknown" : "unknown";
	return {
		version: 1,
		id:
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `crash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		at: Date.now(),
		message: trim(normalized.message, 2000) ?? "Unknown error",
		stack: trim(normalized.stack, 12000),
		componentStack: trim(componentStack ?? undefined, 4000),
		appVersion: String(import.meta.env.VITE_APP_VERSION || "unknown"),
		platform,
	};
}

export function readLastCrashReport(): CrashReport | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(LAST_CRASH_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<CrashReport> | null;
		if (!parsed || parsed.version !== 1 || !parsed.message) return null;
		return {
			version: 1,
			id: String(parsed.id ?? ""),
			at: Number(parsed.at ?? 0),
			message: String(parsed.message),
			stack: typeof parsed.stack === "string" ? parsed.stack : undefined,
			componentStack:
				typeof parsed.componentStack === "string"
					? parsed.componentStack
					: undefined,
			appVersion: String(parsed.appVersion ?? "unknown"),
			platform: String(parsed.platform ?? "unknown"),
		};
	} catch {
		return null;
	}
}

export function saveCrashReport(report: CrashReport): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(LAST_CRASH_STORAGE_KEY, JSON.stringify(report));
	} catch {}
}

export function clearLastCrashReport(): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(LAST_CRASH_STORAGE_KEY);
	} catch {}
}

export function crashReportText(report: CrashReport): string {
	return [
		"TTML Tool local crash report",
		`Time: ${new Date(report.at).toISOString()}`,
		`App version: ${report.appVersion}`,
		`Platform: ${report.platform}`,
		`Message: ${report.message}`,
		report.stack ? `\nStack:\n${report.stack}` : "",
		report.componentStack
			? `\nReact component stack:\n${report.componentStack}`
			: "",
		"\nNo lyrics, audio, project files, account data, names, IP addresses, or room data are included.",
	]
		.filter(Boolean)
		.join("\n");
}

/** A build-time destination. Empty means the report stays local. */
export function crashReportEndpoint(): string {
	return String(import.meta.env.VITE_CRASH_REPORT_URL || "").trim();
}

export async function sendCrashReport(
	report: CrashReport,
	endpoint = crashReportEndpoint(),
): Promise<boolean> {
	if (!endpoint) return false;
	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(report),
			keepalive: true,
		});
		return response.ok;
	} catch {
		return false;
	}
}
