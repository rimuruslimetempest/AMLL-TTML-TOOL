import raw from "../../../CHANGELOG.md?raw";
import packageJson from "../../../package.json";
import { parseChangelog, type ChangelogRelease } from "./parse";

export const APP_VERSION = packageJson.version;
export const CHANGELOG: ChangelogRelease[] = parseChangelog(raw);
export const CURRENT_RELEASE: ChangelogRelease | undefined = CHANGELOG.find(
	(release) => release.version === APP_VERSION,
);
