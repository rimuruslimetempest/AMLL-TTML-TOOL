import { DismissRegular } from "@fluentui/react-icons";
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
import { changelogDialogAtom } from "$/states/dialogs.ts";
import { openExternal } from "$/utils/openExternal";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	const openGitHub = async () => {
		await openExternal(
			"https://github.com/rimuruslimetempest/AMLL-TTML-TOOL/commits/main",
		);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				aria-describedby={undefined}
				style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}
			>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">Changelog &amp; Updates</Dialog.Title>
						<Button
							variant="soft"
							size="1"
							onClick={openGitHub}
							style={{ cursor: "pointer" }}
						>
							View Commits on GitHub
						</Button>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea
					type="always"
					scrollbars="vertical"
					style={{ height: "calc(100% - 60px)" }}
				>
					<Flex direction="column" gap="5" pr="4">
						{CHANGELOG.length === 0 && (
							<Text size="2" color="gray">
								No changelog entries were found. Edit CHANGELOG.md in the
								project to add them.
							</Text>
						)}
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
										<ul
											style={{
												margin: 0,
												paddingLeft: 20,
												lineHeight: 1.55,
											}}
										>
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
			</Dialog.Content>
		</Dialog.Root>
	);
}
