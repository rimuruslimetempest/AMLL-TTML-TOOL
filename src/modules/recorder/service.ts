import { invoke } from "@tauri-apps/api/core";
import { audioEngine } from "$/modules/audio/audio-engine";

export interface RecordingResult {
	path: string;
	fileName: string;
	size: number;
	durationMs: number;
}

export interface RecordingStarted {
	startedAt: number;
	hasAudio: boolean;
}

let audioRecorder: MediaRecorder | null = null;
let audioChunks: BlobPart[] = [];
let videoStartedAt = 0;
let audioStartedAt = 0;

function audioMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	for (const type of [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/ogg;codecs=opus",
	]) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return undefined;
}

function stopAudioRecorder(): Promise<Blob | null> {
	const recorder = audioRecorder;
	audioRecorder = null;
	if (!recorder) return Promise.resolve(null);
	return new Promise((resolve) => {
		const finish = () => {
			const blob =
				audioChunks.length > 0
					? new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" })
					: null;
			audioChunks = [];
			resolve(blob);
		};
		if (recorder.state === "inactive") {
			finish();
			return;
		}
		recorder.addEventListener("stop", finish, { once: true });
		try {
			recorder.stop();
		} catch {
			finish();
		}
	});
}

export async function startScreenRecording(): Promise<RecordingStarted> {
	const started = await invoke<{ startedAt: number }>("start_screen_recording");
	videoStartedAt = started.startedAt;
	audioStartedAt = 0;
	let hasAudio = false;
	try {
		const stream = audioEngine.createRecordingStream();
		if (stream) {
			const mimeType = audioMimeType();
			audioChunks = [];
			audioRecorder = new MediaRecorder(
				stream,
				mimeType
					? { mimeType, audioBitsPerSecond: 128_000 }
					: { audioBitsPerSecond: 128_000 },
			);
			audioRecorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) audioChunks.push(event.data);
			});
			audioRecorder.start(1000);
			audioStartedAt = Date.now();
			hasAudio = true;
		}
	} catch {
		audioRecorder = null;
		audioChunks = [];
		audioEngine.releaseRecordingStream();
	}
	return { startedAt: started.startedAt, hasAudio };
}

export async function stopScreenRecording(): Promise<RecordingResult> {
	const audioBlob = await stopAudioRecorder();
	let audioPath: string | undefined;
	try {
		if (audioBlob && audioBlob.size > 0) {
			try {
				const { tempDir, join } = await import("@tauri-apps/api/path");
				const { writeFile } = await import("@tauri-apps/plugin-fs");
				audioPath = await join(
					await tempDir(),
					`ttml-recording-audio-${Date.now()}.webm`,
				);
				await writeFile(audioPath, new Uint8Array(await audioBlob.arrayBuffer()));
			} catch (cause) {
				// Never leave FFmpeg running because only the audio sidecar failed.
				console.warn("Could not prepare recording audio", cause);
				audioPath = undefined;
			}
		}
		const audioOffsetMs =
			audioStartedAt > 0
				? Math.max(0, audioStartedAt - videoStartedAt)
				: undefined;
		return await invoke<RecordingResult>("stop_screen_recording", {
			audioPath,
			audioOffsetMs,
		});
	} finally {
		audioEngine.releaseRecordingStream();
	}
}

export async function saveScreenRecording(
	result: RecordingResult,
): Promise<string | null> {
	const { save } = await import("@tauri-apps/plugin-dialog");
	const destination = await save({
		defaultPath: result.fileName,
		filters: [{ name: "MP4 video", extensions: ["mp4"] }],
	});
	if (!destination) return null;
	await invoke("save_screen_recording", {
		sourcePath: result.path,
		destinationPath: destination,
	});
	return destination;
}

export async function shareScreenRecording(
	result: RecordingResult,
): Promise<void> {
	await invoke("share_collab_media", {
		path: result.path,
		name: result.fileName,
		kind: "recording",
	});
}
