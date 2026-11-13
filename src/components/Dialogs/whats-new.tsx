import {
	Badge,
	Button,
	Checkbox,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { APP_VERSION, CHANGELOG } from "$/modules/changelog/data";
import {
	whatsNewAutoOpenAtom,
	whatsNewSeenVersionAtom,
} from "$/modules/changelog/states";
import { RELEASES_URL } from "$/config/links";
import { changelogDialogAtom, whatsNewDialogAtom } from "$/states/dialogs";
import { openExternal } from "$/utils/openExternal";

export function WhatsNewDialog() {
	const [isOpen, setIsOpen] = useAtom(whatsNewDialogAtom);
	const [, setSeenVersion] = useAtom(whatsNewSeenVersionAtom);
	const [autoOpen, setAutoOpen] = useAtom(whatsNewAutoOpenAtom);
	const setChangelogOpen = useSetAtom(changelogDialogAtom);
	const [dismissForVersion, setDismissForVersion] = useState(true);

	useEffect(() => {
		if (isOpen) setDismissForVersion(true);
	}, [isOpen]);

	const close = () => {
		if (dismissForVersion) setSeenVersion(APP_VERSION);
		setIsOpen(false);
	};

	const releases = CHANGELOG;

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={(open) => {
				if (open) setIsOpen(true);
				else close();
			}}
		>
			<Dialog.Content maxWidth="720px" style={{ width: "min(94vw, 720px)" }}>
				<Dialog.Title>
					<Flex align="center" gap="2" wrap="wrap">
						What&apos;s new
						<Badge color="ruby" variant="soft">
							v{APP_VERSION}
						</Badge>
					</Flex>
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					Changes in this version of the app.
				</Dialog.Description>

				<ScrollArea style={{ maxHeight: "52vh" }} mt="3">
					<Flex direction="column" gap="4" pr="2">
						{releases.length === 0 && (
							<Text size="2" color="gray">
								No changelog entries were found. Edit CHANGELOG.md in the
								project to add them.
							</Text>
						)}
						{releases.map((release) => (
							<Flex key={release.version} direction="column" gap="2">
								<Flex align="center" gap="2" wrap="wrap">
									<Heading size="3">v{release.version}</Heading>
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
										<BoxList items={section.items} />
									</Flex>
								))}
							</Flex>
						))}
					</Flex>
				</ScrollArea>

				<Flex direction="column" gap="2" mt="3">
					<Text as="label" size="2">
						<Flex gap="2" align="center">
							<Checkbox
								checked={dismissForVersion}
								onCheckedChange={(checked) =>
									setDismissForVersion(checked === true)
								}
							/>
							Don&apos;t show again for this version
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex gap="2" align="center">
							<Checkbox
								checked={autoOpen}
								onCheckedChange={(checked) => setAutoOpen(checked === true)}
							/>
							Show What&apos;s New automatically after updates
						</Flex>
					</Text>
				</Flex>

				<Flex justify="between" gap="2" mt="4" wrap="wrap">
					<Flex gap="2" wrap="wrap">
						<Button
							variant="soft"
							color="gray"
							onClick={() => {
								close();
								setChangelogOpen(true);
							}}
						>
							Full changelog
						</Button>
						{RELEASES_URL && (
							<Button
								variant="soft"
								color="gray"
								onClick={() => openExternal(RELEASES_URL)}
							>
								Releases
							</Button>
						)}
					</Flex>
					<Button onClick={close}>Got it</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

function BoxList({ items }: { items: string[] }) {
	return (
		<ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
			{items.map((item) => (
				<li key={item}>
					<Text size="2">{item}</Text>
				</li>
			))}
		</ul>
	);
}
