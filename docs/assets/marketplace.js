(() => {
	const grid = document.querySelector("#theme-grid");
	const search = document.querySelector("#theme-search");
	const appearance = document.querySelector("#appearance-filter");
	const tagFilter = document.querySelector("#tag-filter");
	const sort = document.querySelector("#sort-filter");
	const count = document.querySelector("#result-count");
	if (!grid) return;

	let themes = [];
	let loaded = false;

	function absolute(path) {
		try {
			return new URL(path, window.location.href).href;
		} catch {
			return path;
		}
	}

	function performanceLabel(level) {
		if (level === "medium") return "Medium";
		if (level === "heavy") return "Heavy";
		return "Light";
	}

	function themeMatches(theme) {
		const term = (search?.value ?? "").trim().toLowerCase();
		const wantedAppearance = appearance?.value ?? "all";
		const wantedTag = tagFilter?.value ?? "all";
		if (wantedAppearance !== "all" && theme.appearance !== wantedAppearance)
			return false;
		if (wantedTag !== "all" && !(theme.tags ?? []).includes(wantedTag))
			return false;
		if (!term) return true;
		const haystack = [
			theme.name,
			theme.author,
			theme.description,
			...(theme.tags ?? []),
		]
			.join(" ")
			.toLowerCase();
		return haystack.includes(term);
	}

	function card(theme) {
		const article = document.createElement("article");
		article.className = "theme-card";

		const image = document.createElement("img");
		image.className = "theme-preview";
		image.src = absolute(theme.preview);
		image.alt = `${theme.name} theme preview`;
		image.loading = "lazy";
		image.width = 800;
		image.height = 450;

		const body = document.createElement("div");
		body.className = "theme-body";

		const titleRow = document.createElement("div");
		titleRow.className = "theme-title";
		const title = document.createElement("h3");
		title.textContent = theme.name;
		titleRow.append(title);
		if (theme.verified) {
			const verified = document.createElement("span");
			verified.className = "badge verified";
			verified.textContent = "Verified";
			verified.title = "Reviewed when it was added";
			titleRow.append(verified);
		}

		const byline = document.createElement("p");
		byline.className = "byline";
		byline.textContent = `by ${theme.author} · v${theme.version}`;

		const description = document.createElement("p");
		description.className = "desc";
		description.textContent = theme.description;

		const reviewNote = document.createElement("p");
		reviewNote.className = "byline";
		if (!theme.verified) {
			reviewNote.textContent = "Community theme, not reviewed by the app.";
		}

		const badges = document.createElement("div");
		badges.className = "badges";
		const perf = document.createElement("span");
		perf.className = `badge ${theme.performance}`;
		perf.textContent = `${performanceLabel(theme.performance)} performance`;
		const app = document.createElement("span");
		app.className = "badge";
		app.textContent = `Needs app ${theme.minAppVersion}+`;
		const mode = document.createElement("span");
		mode.className = "badge";
		mode.textContent = theme.appearance === "light" ? "Light" : "Dark";
		badges.append(perf, app, mode);

		const tags = document.createElement("div");
		tags.className = "tags";
		for (const tag of theme.tags ?? []) {
			const item = document.createElement("span");
			item.className = "tag";
			item.textContent = `#${tag}`;
			tags.append(item);
		}

		const actions = document.createElement("div");
		actions.className = "theme-actions";
		const download = document.createElement("a");
		download.className = "btn primary small";
		download.href = absolute(theme.download);
		download.download = `${theme.id}.json`;
		download.textContent = "Download";
		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "btn ghost small";
		copy.textContent = "Copy install text";
		copy.addEventListener("click", async () => {
			const text = [
				`${theme.name} v${theme.version} by ${theme.author}`,
				`Download: ${absolute(theme.download)}`,
				`SHA-256: ${theme.sha256}`,
				"",
				"In TTML Tool: Settings → Appearance → Themes → Manage themes → Import. A preview appears before install.",
			].join("\n");
			try {
				await navigator.clipboard.writeText(text);
				copy.textContent = "Copied";
			} catch {
				copy.textContent = "Select the download link to copy it";
			}
			setTimeout(() => {
				copy.textContent = "Copy install text";
			}, 2200);
		});
		actions.append(download, copy);

		body.append(titleRow, byline, description, reviewNote, badges, tags, actions);
		article.append(image, body);
		return article;
	}

	function render() {
		if (!loaded) return;
		const filtered = themes
			.filter(themeMatches)
			.sort((a, b) =>
				(sort?.value ?? "name") === "newest"
					? 0
					: a.name.localeCompare(b.name),
			);
		grid.replaceChildren();
		if (filtered.length === 0) {
			const empty = document.createElement("div");
			empty.className = "empty";
			empty.textContent =
				themes.length === 0
					? "No themes are listed yet. Check back soon, or submit the first one."
					: "No themes match that search and filter.";
			grid.append(empty);
		} else {
			for (const theme of filtered) grid.append(card(theme));
		}
		if (count) {
			count.textContent = `${filtered.length} theme${filtered.length === 1 ? "" : "s"} shown`;
		}
	}

	function populateTags(items) {
		if (!tagFilter) return;
		const tags = [...new Set(items.flatMap((theme) => theme.tags ?? []))].sort(
			(a, b) => a.localeCompare(b),
		);
		for (const tag of tags) {
			const option = document.createElement("option");
			option.value = tag;
			option.textContent = `#${tag}`;
			tagFilter.append(option);
		}
	}

	async function load() {
		try {
			const response = await fetch("./registry/themes.json", {
				headers: { accept: "application/json" },
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			themes = Array.isArray(data.themes) ? data.themes : [];
			populateTags(themes);
			loaded = true;
			render();
		} catch {
			loaded = true;
			themes = [];
			grid.replaceChildren();
			const empty = document.createElement("div");
			empty.className = "empty";
			empty.innerHTML =
				'The theme list could not be loaded. Check your connection, or open <a href="./registry/themes.json">registry/themes.json</a> directly.';
			grid.append(empty);
			if (count) count.textContent = "Registry unavailable";
		}
	}

	search?.addEventListener("input", render);
	appearance?.addEventListener("change", render);
	tagFilter?.addEventListener("change", render);
	sort?.addEventListener("change", render);
	void load();
})();
