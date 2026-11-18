/** Public project identity and contact details. */
export const APP_NAME = "TTML Tool";
export const AUTHOR_NAME = "Rimurulover";
export const GITHUB_USERNAME = "rimuruslimetempest";
export const REPOSITORY_URL =
	"https://github.com/rimuruslimetempest/ttml-tool";
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const REPORT_EMAIL = "rimurusamllttmltool@gmail.com";

function describeOs(): string {
	if (typeof navigator === "undefined") return "Unknown OS";
	const ua = navigator.userAgent;
	if (/Windows NT 10/i.test(ua)) return "Windows 10/11";
	if (/Windows NT/i.test(ua)) return "Windows";
	if (/Mac OS X/i.test(ua)) return "macOS";
	if (/Android/i.test(ua)) return "Android";
	if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
	if (/Linux/i.test(ua)) return "Linux";
	return "Unknown OS";
}

/**
 * A deliberately small report body: app version and OS only. Lyrics, audio,
 * file names, room codes and display names are never included.
 */
export function buildReportProblemUrl(version: string): string {
	const subject = `TTML Tool problem report - v${version}`;
	const body = [
		`App version: ${version}`,
		`OS: ${describeOs()}`,
		"",
		"What happened:",
		"",
		"",
		"Steps to reproduce:",
		"1. ",
		"",
	].join("\n");
	return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
