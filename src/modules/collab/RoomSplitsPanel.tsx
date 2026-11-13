import {
	Badge,
	Button,
	Callout,
	Dialog,
	Flex,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "react-toastify";
import {
	partsForPattern,
	savePatternToLibrary,
	sharedSplitToPattern,
} from "$/modules/split-library/logic";
import { splitLibraryAtom } from "$/modules/split-library/states";
import { saveFile } from "$/utils/fileSystem";
import { collabClient } from "./client";
import { can } from "./permissions";
import {
	collabActiveAtom,
	collabPanelAtom,
	collabRoleAtom,
	collabSplitDictionaryAtom,
} from "./states";

/**
 * Browse the room's shared split suggestions. Entries live in the room
 * session only; people are nudged to save or export anything they want to keep.
 */
export function RoomSplitsPanel({ onClose }: { onClose: () => void }) {
	const active = useAtomValue(collabActiveAtom);
	const role = useAtomValue(collabRoleAtom);
	const splits = useAtomValue(collabSplitDictionaryAtom);
	const setLibrary = useSetAtom(splitLibraryAtom);
	const setPanel = useSetAtom(collabPanelAtom);
	const canView = can(role, "viewRoomSplits");
	const canRemove = can(role, "removeRoomSplit");

	const saveOne = (id: string) => {
		const suggestion = splits.find((entry) => entry.id === id);
		if (!suggestion) return;
		const pattern = sharedSplitToPattern(suggestion);
		if (!pattern) return;
		setLibrary((library) => savePatternToLibrary(library, pattern));
		toast.success("Saved to your split library.");
	};

	const saveAll = () => {
		if (splits.length === 0) return;
		setLibrary((library) => {
			let next = library;
			for (const suggestion of splits) {
				const pattern = sharedSplitToPattern(suggestion);
				if (pattern) next = savePatternToLibrary(next, pattern);
			}
			return next;
		});
		toast.success(`Saved ${splits.length} room split(s) to your library.`);
	};

	const exportDictionary = async () => {
		try {
			const name = await saveFile(
				JSON.stringify(
					{
						version: 1,
						exportedAt: new Date().toISOString(),
						splits,
					},
					null,
					2,
				),
				{ suggestedName: "room-split-dictionary.json" },
			);
			if (name) toast.success("Room split dictionary exported.");
		} catch {
			toast.error("Could not export the room split dictionary.");
		}
	};

	return (
		<Dialog.Root
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Dialog.Content maxWidth="680px" style={{ width: "min(94vw, 680px)" }}>
				<Dialog.Title>Room split dictionary</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					Suggestions shared by people in this room. Nothing is applied to
					anyone's lyrics automatically.
				</Dialog.Description>

				{!active ? (
					<Callout.Root color="gray" mt="3">
						<Callout.Text>Join a live room to see its shared splits.</Callout.Text>
					</Callout.Root>
				) : !canView ? (
					<Callout.Root color="amber" mt="3">
						<Callout.Text>
							Viewers cannot browse room splits. Ask the host for commenter
							access.
						</Callout.Text>
					</Callout.Root>
				) : (
					<Flex direction="column" gap="2" mt="3">
						<Callout.Root color="gray">
							<Callout.Text>
								This dictionary is kept only for the room session. When the room
								closes it is gone, so save entries to your library or export
								them before leaving.
							</Callout.Text>
						</Callout.Root>

						<Flex gap="2" wrap="wrap">
							<Button
								size="1"
								variant="soft"
								onClick={saveAll}
								disabled={splits.length === 0}
							>
								Save all to my library
							</Button>
							<Button
								size="1"
								variant="soft"
								onClick={exportDictionary}
								disabled={splits.length === 0}
							>
								Export dictionary
							</Button>
							<Button
								size="1"
								variant="soft"
								onClick={() => setPanel("library")}
							>
								Open my split library
							</Button>
						</Flex>

						{splits.length === 0 ? (
							<Text size="2" color="gray">
								No shared splits yet. Save a split from the Split Word dialog
								and choose “Share with room”.
							</Text>
						) : (
							<ScrollArea style={{ maxHeight: "40vh" }}>
								<Flex direction="column" gap="2" pr="2">
									{splits.map((entry) => (
										<Flex
											key={entry.id}
											direction="column"
											gap="1"
											p="2"
											style={{
												background: "var(--gray-3)",
												borderRadius: "var(--radius-2)",
											}}
										>
											<Flex gap="2" align="center" wrap="wrap">
												<Text weight="medium">{entry.displayWord}</Text>
												<Badge color="purple" variant="soft">
													{partsForPattern(
														entry.displayWord,
														entry.boundaries,
													).join(" / ")}
												</Badge>
												{entry.label.trim() && (
													<Text size="1" color="gray">
														{entry.label}
													</Text>
												)}
												<Text size="1" color="gray" ml="auto">
													by {entry.addedByName}
												</Text>
											</Flex>
											{entry.note.trim() && (
												<Text size="1" color="gray">
													{entry.note}
												</Text>
											)}
											<Flex gap="2" justify="end">
												<Button
													size="1"
													variant="soft"
													onClick={() => saveOne(entry.id)}
												>
													Save to my library
												</Button>
												{canRemove && (
													<Button
														size="1"
														variant="soft"
														color="red"
														onClick={() =>
															collabClient.removeSharedSplit(entry.id)
														}
													>
														Remove
													</Button>
												)}
											</Flex>
										</Flex>
									))}
								</Flex>
							</ScrollArea>
						)}
					</Flex>
				)}

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							Close
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
