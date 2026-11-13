const KNOWN_DATABASES = [
	"amll-autosave-db",
	"amll-custom-background",
	"firebaseLocalStorageDb",
	"firebase-installations-database",
	"firebase-messaging-database",
];

const deleteDatabase = (name: string) =>
	new Promise<void>((resolve) => {
		if (typeof indexedDB === "undefined") {
			resolve();
			return;
		}
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = finish;
		request.onerror = finish;
		request.onblocked = finish;
		// A blocked delete should not leave the settings dialog spinning forever.
		setTimeout(finish, 2500);
	});

/**
 * Deletes this origin's local app state. It deliberately does not touch the
 * cloud account or cloud library; those require separate in-app actions or a
 * deletion request.
 */
export async function clearLocalAppData(): Promise<void> {
	const databaseNames = new Set(KNOWN_DATABASES);
	try {
		const databases = await indexedDB.databases?.();
		for (const database of databases || []) {
			if (database.name) databaseNames.add(database.name);
		}
	} catch {
		// `indexedDB.databases()` is not available in every webview.
	}

	await Promise.all([...databaseNames].map((name) => deleteDatabase(name)));

	try {
		if (typeof caches !== "undefined") {
			const names = await caches.keys();
			await Promise.all(names.map((name) => caches.delete(name)));
		}
	} catch {
		// Cache API is optional.
	}

	try {
		localStorage.clear();
	} catch {
		// Ignore locked storage.
	}
	try {
		sessionStorage.clear();
	} catch {
		// Ignore locked storage.
	}
}
