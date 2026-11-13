import {
	Badge,
	Button,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { APP_VERSION, CHANGELOG } from "$/modules/changelog/data";
import { RELEASES_URL } from "$/config/links";
import { changelogDialogAtom } from "$/states/dialogs";
import { openExternal } from "$/utils/openExternal";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content maxWidth="760px" style={{ width: "min(94vw, 760px)" }}>
				<Dialog.Title>Changelog &amp; updates</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					Newest first. This list comes from CHANGELOG.md in the app package.
				</Dialog.Description>

				<ScrollArea style={{ maxHeight: "62vh" }} mt="3">
					<Flex direction="column" gap="5" pr="2">
						{CHANGELOG.map((release) => (
							<Flex key={release.version} direction="column" gap="2">
								<Flex align="center" gap="2" wrap="wrap">
									<Heading size="4">v{release.version}</Heading>
									{release.version === APP_VERSION && (
										<Badge color="green" variant="soft">
											Current
										</Badge>
									)}
									{release.date && (
										<Text size="1" color="gray">
											{release.date}
										</Text>
									)}
								</Flex>
								{release.sections.map((section) => (
									<Flex
										key={`${release.version}-${section.title}`}
										direction="column"
										gap="1"
									>
										<Text size="2" weight="medium">
											{section.title}
										</Text>
										<ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
											{section.items.map((item) => (
												<li key={item}>
													<Text size="2">{item}</Text>
												</li>
											))}
										</ul>
									</Flex>
								))}
							</Flex>
						))}
					</Flex>
				</ScrollArea>

				<Flex justify="end" gap="2" mt="4">
					{RELEASES_URL && (
						<Button
							variant="soft"
							color="gray"
							onClick={() => openExternal(RELEASES_URL)}
						>
							Releases
						</Button>
					)}
					<Dialog.Close>
						<Button>Close</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
