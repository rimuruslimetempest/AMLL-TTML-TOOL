type AnnounceSink = (message: string) => void;

let sink: AnnounceSink | null = null;

export function setAnnounceSink(next: AnnounceSink | null): void {
	sink = next;
}

/** Announces a short status change to screen readers. */
export function announce(message: string): void {
	if (!message.trim()) return;
	sink?.(message);
}
