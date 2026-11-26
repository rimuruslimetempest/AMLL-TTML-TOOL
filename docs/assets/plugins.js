(() => {
	const grid = document.querySelector("#plugin-grid");
	const search = document.querySelector("#plugin-search");
	const typeFilter = document.querySelector("#type-filter");
	const sort = document.querySelector("#sort-filter");
	const count = document.querySelector("#result-count");
	if (!grid) return;

	let plugins = [];
	let loaded = false;

	const PERMISSION_LABELS = {
		"lyrics:read": "Read lyrics",
		"lyrics:write": "Change lyrics",
		"files:read": "Read files",
		"files:write": "Write files",
		network: "Network",
		"settings:read": "Read settings",
		"ui:toolbar": "Toolbar button",
		"ui:panel": "Side panel",
	};

	function absolute(path) {
		try {
			return new URL(path, window.location.href).href;
		} catch {
			return path;
		}
	}

	function typeLabel(type) {
		if (type === "importer") return "Importer";
		if (type === "exporter") return "Exporter";
		if (type === "tool") return "Lyric tool";
		return "Importer + exporter";
	}

	function matches(plugin) {
		const term = (search?.value ?? "").trim().toLowerCase();
		const wantedType = typeFilter?.value ?? "all";
		if (wantedType !== "all" && plugin.type !== wantedType) return false;
		if (!term) return true;
		return [
			plugin.name,
			plugin.author,
			plugin.description,
			...(plugin.tags ?? []),
		]
			.join(" ")
			.toLowerCase()
			.includes(term);
	}

	function badge(text, className = "") {
		const item = document.createElement("span");
		item.className = `badge ${className}`.trim();
		item.textContent = text;
		return item;
	}

	function card(plugin) {
		const article = document.createElement("article");
		article.className = "theme-card";

		const body = document.createElement("div");
		body.className = "theme-body";

		const titleRow = document.createElement("div");
		titleRow.className = "theme-title";
		const icon = document.createElement("span");
		icon.className = "plugin-icon";
		icon.setAttribute("aria-hidden", "true");
		icon.textContent = plugin.name.slice(0, 2).toUpperCase();
		const title = document.createElement("h3");
		title.textContent = plugin.name;
		titleRow.append(icon, title);
		if (plugin.verified) {
			const verified = badge("Verified", "verified");
			verified.title = "Reviewed when it was added";
			titleRow.append(verified);
		}
		if (plugin.deprecated) article.append(badge("Deprecated", "heavy"));

		const byline = document.createElement("p");
		byline.className = "byline";
		byline.textContent = `by ${plugin.author} · v${plugin.version}`;

		const description = document.createElement("p");
		description.className = "desc";
		description.textContent = plugin.description;

		const badges = document.createElement("div");
		badges.className = "badges";
		badges.append(
			badge(typeLabel(plugin.type)),
			badge(`API ${plugin.apiVersion ?? 2}`),
			badge(`Needs app ${plugin.minAppVersion ?? "1.0.0"}+`),
		);
		if (typeof plugin.size === "number") {
			badges.append(badge(`${(plugin.size / 1024).toFixed(0)} KB`));
		}

		const permissions = document.createElement("div");
		permissions.className = "badges";
		const declared = plugin.permissions ?? [];
		if (declared.length === 0) {
			permissions.append(badge("No permissions declared", "permission"));
		} else {
			for (const permission of declared) {
				permissions.append(
					badge(PERMISSION_LABELS[permission] ?? permission, "permission"),
				);
			}
		}

		const tags = document.createElement("div");
		tags.className = "tags";
		for (const tag of plugin.tags ?? []) {
			const item = document.createElement("span");
			item.className = "tag";
			item.textContent = `#${tag}`;
			tags.append(item);
		}

		const actions = document.createElement("div");
		actions.className = "theme-actions";
		const download = document.createElement("a");
		download.className = "btn primary small";
		download.href = absolute(plugin.download);
		download.textContent = "Download .wasm";
		const manifest = document.createElement("a");
		manifest.className = "btn ghost small";
		manifest.href = absolute(
			plugin.download.replace(/[^/]+$/, "plugin.json"),
		);
		manifest.textContent = "plugin.json";
		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "btn ghost small";
		copy.textContent = "Copy install text";
		copy.addEventListener("click", async () => {
			const text = [
				`${plugin.name} v${plugin.version} by ${plugin.author}`,
				`Plugin: ${absolute(plugin.download)}`,
				`Manifest: ${absolute(plugin.download.replace(/[^/]+$/, "plugin.json"))}`,
				`SHA-256: ${plugin.sha256}`,
				`Permissions: ${declared.length ? declared.join(", ") : "none declared"}`,
				"",
				"In TTML Tool: Plugins → Plugin Store → Install. Or sideload the .wasm and plugin.json.",
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
		actions.append(download, manifest, copy);

		body.append(titleRow, byline, description, badges, permissions, tags, actions);
		article.append(body);
		return article;
	}

	function render() {
		if (!loaded) return;
		const filtered = plugins
			.filter(matches)
			.sort((a, b) =>
				(sort?.value ?? "name") === "newest"
					? String(b.addedAt ?? "").localeCompare(String(a.addedAt ?? ""))
					: a.name.localeCompare(b.name),
			);
		grid.replaceChildren();
		if (filtered.length === 0) {
			const empty = document.createElement("div");
			empty.className = "empty";
			empty.textContent =
				plugins.length === 0
					? "No plugins are listed yet. Check back soon, or submit the first one."
					: "No plugins match that search and filter.";
			if (plugins.length === 0) {
				const link = document.createElement("a");
				link.href = "./submit.html";
				link.textContent = " Submit a plugin";
				empty.append(link);
			}
			grid.append(empty);
		} else {
			for (const plugin of filtered) grid.append(card(plugin));
		}
		if (count) {
			count.textContent = `${filtered.length} plugin${filtered.length === 1 ? "" : "s"} shown`;
		}
	}

	async function load() {
		try {
			const response = await fetch("./registry/plugins.json", {
				headers: { accept: "application/json" },
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			plugins = Array.isArray(data.plugins) ? data.plugins : [];
			loaded = true;
			render();
		} catch {
			loaded = true;
			plugins = [];
			grid.replaceChildren();
			const empty = document.createElement("div");
			empty.className = "empty";
			empty.innerHTML =
				'The plugin list could not be loaded. Check your connection, or open <a href="./registry/plugins.json">registry/plugins.json</a> directly.';
			grid.append(empty);
			if (count) count.textContent = "Registry unavailable";
		}
	}

	search?.addEventListener("input", render);
	typeFilter?.addEventListener("change", render);
	sort?.addEventListener("change", render);
	void load();
})();
