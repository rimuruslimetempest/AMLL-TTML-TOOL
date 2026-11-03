import { Button, Dialog, Flex, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useFileOpener } from "$/hooks/useFileOpener";
import { resolveAudioFileName } from "$/modules/audio/utils/audio-url";
import { error as logError } from "$/utils/logging";

interface AudioUrlDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const AudioUrlDialog = ({ open, onOpenChange }: AudioUrlDialogProps) => {
	const { openFile } = useFileOpener();
	const { t } = useTranslation();
	const [value, setValue] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLoad = async () => {
		let url: URL;
		try {
			url = new URL(value.trim());
		} catch {
			toast.error(
				t("audioPanel.urlInvalid", "Enter a valid http(s) audio link"),
			);
			return;
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			toast.error(
				t("audioPanel.urlInvalid", "Enter a valid http(s) audio link"),
			);
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(url, { mode: "cors" });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const blob = await response.blob();
			const fileName = resolveAudioFileName(
				url,
				blob.type || response.headers.get("content-type"),
			);
			if (!fileName) {
				toast.error(
					t(
						"audioPanel.urlNotAudio",
						"That link is not an audio file. Use a direct link ending in .mp3, .flac, .wav, .ogg or .m4a.",
					),
				);
				return;
			}
			if (!blob.size) throw new Error("Empty audio response");
			openFile(
				new File([blob], fileName, {
					type: blob.type || "application/octet-stream",
				}),
			);
			onOpenChange(false);
			setValue("");
		} catch (error) {
			logError("Failed to load audio from URL", error);
			toast.error(
				t(
					"audioPanel.urlLoadFailed",
					"Could not download that link. The site may block cross-origin downloads, so try a direct link that ends in an audio extension.",
				),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="480px">
				<Dialog.Title>
					{t("audioPanel.loadFromUrlTitle", "Load Audio from URL")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="3">
					{t(
						"audioPanel.loadFromUrlDescription",
						"Paste a direct link to an audio file, such as from Internet Archive, Free Music Archive or Wikimedia Commons. The site must allow cross-origin downloads; streaming pages and YouTube links do not work.",
					)}
				</Dialog.Description>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleLoad();
					}}
				>
					<TextField.Root
						type="url"
						placeholder="https://example.com/song.flac"
						value={value}
						disabled={loading}
						onChange={(event) => setValue(event.currentTarget.value)}
					/>
					<Flex gap="3" mt="4" justify="end">
						<Button
							type="button"
							variant="soft"
							color="gray"
							disabled={loading}
							onClick={() => onOpenChange(false)}
						>
							{t("confirmDialog.cancel", "Cancel")}
						</Button>
						<Button type="submit" disabled={loading}>
							{loading
								? t("audioPanel.loadFromUrlLoading", "Downloading…")
								: t("audioPanel.loadFromUrlAction", "Load")}
						</Button>
					</Flex>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	);
};