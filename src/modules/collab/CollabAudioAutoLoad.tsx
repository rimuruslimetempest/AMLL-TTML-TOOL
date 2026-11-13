import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { audioErrorAtom } from "$/modules/audio/states";
import { globalStore } from "$/states/store";
import { latestSharedAudio } from "./logic";
import { loadSharedAudio } from "./shared-audio";
import { collabMediaAtom, collabRoleAtom, collabSessionAtom } from "./states";

/**
 * Guests hear the host's song without a download/save step. The fetched Blob
 * stays in memory for this room session and is never added to the audio cache.
 */
export function CollabAudioAutoLoad() {
	const media = useAtomValue(collabMediaAtom);
	const role = useAtomValue(collabRoleAtom);
	const session = useAtomValue(collabSessionAtom);
	const attempted = useRef(new Set<string>());
	const roomId = useRef<string | null>(null);
	const requestId = useRef(0);

	useEffect(() => {
		const nextRoomId = session?.roomId ?? null;
		if (roomId.current === nextRoomId) return;
		roomId.current = nextRoomId;
		attempted.current.clear();
		requestId.current += 1;
	}, [session?.roomId]);

	useEffect(() => {
		if (!role || role === "host" || !session) return;
		const item = latestSharedAudio(media);
		if (!item || attempted.current.has(item.id)) return;
		attempted.current.add(item.id);
		const request = ++requestId.current;
		void loadSharedAudio(session, item)
			.then(() => {
				if (request !== requestId.current) return;
				toast.success(
					`Loaded shared song "${item.name}" without saving a copy.`,
					{ toastId: `collab-audio-${item.id}` },
				);
			})
			.catch((error: unknown) => {
				if (request !== requestId.current) return;
				attempted.current.delete(item.id);
				if (globalStore.get(audioErrorAtom)) return;
				toast.error(
					error instanceof Error
						? error.message
						: "Could not load the shared song.",
					{ toastId: `collab-audio-error-${item.id}` },
				);
			});
	}, [media, role, session]);

	return null;
}
