export interface ChangelogSection {
	title: string;
	items: string[];
}

export interface ChangelogRelease {
	version: string;
	date: string;
	sections: ChangelogSection[];
}

const SECTION_NAMES: Record<string, string> = {
	highlights: "Highlights",
	new: "New",
	added: "Added",
	improved: "Improved",
	changed: "Improved",
	fixed: "Fixed",
	credits: "Credits",
};

/**
 * Reads the small, intentionally boring subset of Markdown used by
 * CHANGELOG.md: "## [version] - date" and "### Added / Improved / Fixed".
 * Anything else is ignored rather than rendered as raw HTML.
 */
export function parseChangelog(raw: string): ChangelogRelease[] {
	const releases: ChangelogRelease[] = [];
	let current: ChangelogRelease | null = null;
	let section: ChangelogSection | null = null;

	for (const line of raw.split(/\r?\n/)) {
		const heading = line.match(/^##\s+\[?([^\]\s]+)\]?\s*(?:-\s*(.*))?$/);
		if (heading) {
			current = {
				version: heading[1].trim(),
				date: (heading[2] ?? "").trim(),
				sections: [],
			};
			releases.push(current);
			section = null;
			continue;
		}
		if (!current) continue;
		const subheading = line.match(/^###\s+(.+)$/);
		if (subheading) {
			const title = SECTION_NAMES[subheading[1].trim().toLowerCase()];
			section = title ? { title, items: [] } : null;
			if (section) current.sections.push(section);
			continue;
		}
		const item = line.match(/^\s*[-*]\s+(.+)$/);
		if (item && section) section.items.push(item[1].trim());
	}

	return releases.filter((release) =>
		release.sections.some((entry) => entry.items.length > 0),
	);
}
