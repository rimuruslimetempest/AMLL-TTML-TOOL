const AUDIO_EXTENSIONS = new Set([
	"opus",
	"flac",
	"webm",
	"weba",
	"wav",
	"ogg",
	"m4a",
	"oga",
	"mp3",
	"aiff",
	"wma",
	"au",
]);

const MIME_EXTENSIONS: Record<string, string> = {
	"audio/mpeg": "mp3",
	"audio/mp3": "mp3",
	"audio/flac": "flac",
	"audio/x-flac": "flac",
	"audio/wav": "wav",
	"audio/x-wav": "wav",
	"audio/wave": "wav",
	"audio/vnd.wave": "wav",
	"audio/ogg": "ogg",
	"audio/opus": "opus",
	"audio/mp4": "m4a",
	"audio/x-m4a": "m4a",
	"audio/aac": "m4a",
	"audio/webm": "webm",
};

export const isSupportedAudioExtension = (extension: string) =>
	AUDIO_EXTENSIONS.has(extension.toLowerCase());

/**
 * Picks a filename for a downloaded audio file so the existing file importer
 * can route it by extension. Returns null when neither the URL path nor the
 * content type looks like audio (for example a link to a web page).
 */
export const resolveAudioFileName = (
	url: URL,
	contentType: string | null,
): string | null => {
	const rawName = url.pathname.split("/").pop() ?? "";
	let name = rawName;
	try {
		name = decodeURIComponent(rawName);
	} catch {
		// Keep the undecoded segment when it contains malformed escapes.
	}
	name = name.trim();
	const extension = name.includes(".")
		? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
		: "";
	if (extension && isSupportedAudioExtension(extension)) return name;

	const mime = (contentType ?? "").split(";")[0].trim().toLowerCase();
	const mimeExtension = MIME_EXTENSIONS[mime];
	if (!mimeExtension) return null;

	const base = name.replace(/\.[^./]*$/, "").trim() || "audio";
	return `${base}.${mimeExtension}`;
};