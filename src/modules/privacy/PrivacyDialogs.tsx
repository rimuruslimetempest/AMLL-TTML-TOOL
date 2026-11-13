import {
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	Heading,
	Text,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
	acceptFeatureConsent,
	writeConsentRecord,
} from "./consent";
import {
	PRIVACY_FEATURE_LABEL,
	PRIVACY_POLICY_UPDATED,
	PRIVACY_POLICY_VERSION,
	type PrivacyFeature,
} from "./constants";
import { PrivacyPolicyContent, TermsContent } from "./PrivacyDocuments";
import {
	privacyConsentAtom,
	privacyPolicyDialogAtom,
	privacyPromptAtom,
	termsDialogAtom,
} from "./states";
import { usePrivacyGate } from "./usePrivacyGate";

export function PrivacyConsentLinks() {
	const setPolicyOpen = useSetAtom(privacyPolicyDialogAtom);
	const setTermsOpen = useSetAtom(termsDialogAtom);
	return (
		<Flex gap="1" wrap="wrap" align="center">
			<Button
				type="button"
				variant="ghost"
				size="1"
				onClick={() => setPolicyOpen(true)}
			>
				Privacy Policy
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="1"
				onClick={() => setTermsOpen(true)}
			>
				Terms of Use
			</Button>
		</Flex>
	);
}

const ConsentDetails = ({ feature }: { feature: PrivacyFeature }) =>
	feature === "live" ? (
		<>
			<Text as="p" size="2" style={{ margin: "8px 0 0" }}>
				Hosting or joining a room sends the shared TTML project, edits,
				display name, color, connection data, chat, and any shared audio or
				recordings to the host and everyone in the room. Anyone with the invite
				link can join. The host and network peers can see IP addresses. A
				Cloudflare Quick Tunnel also processes the connection. Rooms are not
				end-to-end encrypted.
			</Text>
			<Text as="p" size="2" style={{ margin: "8px 0 0" }}>
				If you are a guest, shared song audio is loaded into memory for
				playback and is not saved to disk unless you download it.
			</Text>
		</>
	) : (
		<>
			<Text as="p" size="2" style={{ margin: "8px 0 0" }}>
				Signing in sends your account details to Firebase: email, display name,
				profile photo URL, provider ID, user ID, and authentication metadata.
				Cloud saves, optional audio uploads, avatars, and published works are
				stored in Firebase.
			</Text>
			<Text as="p" size="2" style={{ margin: "8px 0 0" }}>
				The current Firebase rules allow public read access to user profile and
				cloud library paths. Treat cloud saves as potentially public, not as a
				private vault. If Firebase Storage is unavailable, an avatar may be
				uploaded publicly to Litterbox for 72 hours or to Imgur.
			</Text>
		</>
	);

export function PrivacyConsentDialog() {
	const [prompt, setPrompt] = useAtom(privacyPromptAtom);
	const [consent, setConsent] = useAtom(privacyConsentAtom);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		if (!prompt) return;
		setChecked(false);
	}, [prompt]);

	const accept = () => {
		if (!prompt || !checked) return;
		const next = acceptFeatureConsent(consent, prompt.feature);
		writeConsentRecord(next);
		setConsent(next);
		const action = prompt.action;
		setPrompt(null);
		if (prompt.feature === "cloud") {
			void import("$/modules/cloud/firebase")
				.then(({ initFirebase }) => initFirebase())
				.catch(() => {});
		}
		try {
			action?.();
		} catch {
			// The feature will surface its own error if the action still fails.
		}
	};

	return (
		<Dialog.Root
			open={Boolean(prompt)}
			onOpenChange={(open) => {
				if (!open) setPrompt(null);
			}}
		>
			<Dialog.Content maxWidth="560px">
				<Dialog.Title>
					{prompt
						? `Before you use ${PRIVACY_FEATURE_LABEL[prompt.feature]}`
						: "Privacy consent"}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					Review what this feature sends and where it goes before continuing.
				</Dialog.Description>
				{prompt?.reason && (
					<Text as="p" size="2" mt="2">
						{prompt.reason}
					</Text>
				)}
				{prompt && (
					<Card variant="surface" mt="3" style={{ padding: 14 }}>
						<ConsentDetails feature={prompt.feature} />
					</Card>
				)}
				<Text as="p" size="1" color="gray" mt="3">
					Policy version {PRIVACY_POLICY_VERSION}, effective{" "}
					{PRIVACY_POLICY_UPDATED}. You can withdraw consent at any time in
					Settings → Privacy.
				</Text>
				<Flex align="start" gap="2" mt="3">
					<Checkbox
						id="privacy-consent-checkbox"
						checked={checked}
						onCheckedChange={(value) => setChecked(value === true)}
					/>
					<Text as="label" htmlFor="privacy-consent-checkbox" size="2">
						I have read the Privacy Policy and Terms of Use, and I agree to the
						data handling described above for this feature.
					</Text>
				</Flex>
				<PrivacyConsentLinks />
				<Flex justify="end" gap="2" mt="4">
					<Button
						type="button"
						variant="soft"
						color="gray"
						onClick={() => setPrompt(null)}
					>
						Not now
					</Button>
					<Button type="button" disabled={!checked} onClick={accept}>
						Agree and continue
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

const DocumentDialog = ({
	open,
	onOpenChange,
	title,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: React.ReactNode;
}) => (
	<Dialog.Root open={open} onOpenChange={onOpenChange}>
		<Dialog.Content
			maxWidth="780px"
			style={{ maxHeight: "86vh", overflowY: "auto" }}
		>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description size="1" color="gray">
				This document describes the actual data flows in this build. Items
				marked [TODO] still need legal or operational confirmation.
			</Dialog.Description>
			<Box mt="3">{children}</Box>
			<Flex justify="end" mt="5">
				<Dialog.Close>
					<Button type="button" variant="soft">
						Close
					</Button>
				</Dialog.Close>
			</Flex>
		</Dialog.Content>
	</Dialog.Root>
);

export function PrivacyPolicyDialog() {
	const [open, setOpen] = useAtom(privacyPolicyDialogAtom);
	return (
		<DocumentDialog
			open={open}
			onOpenChange={setOpen}
			title="Privacy Policy"
		>
			<PrivacyPolicyContent />
		</DocumentDialog>
	);
}

export function TermsDialog() {
	const [open, setOpen] = useAtom(termsDialogAtom);
	return (
		<DocumentDialog open={open} onOpenChange={setOpen} title="Terms of Use">
			<TermsContent />
		</DocumentDialog>
	);
}

export function PrivacyDialogs() {
	return (
		<>
			<PrivacyConsentDialog />
			<PrivacyPolicyDialog />
			<TermsDialog />
		</>
	);
}

export function PrivacyLinksCard() {
	return (
		<Card variant="surface" style={{ padding: 16 }}>
			<Flex direction="column" gap="2">
				<Heading size="3">Privacy and terms</Heading>
				<Text size="2" color="gray">
					Review how local projects, live rooms, cloud accounts, AI review,
					diagnostics, and third-party imports handle data.
				</Text>
				<PrivacyConsentLinks />
			</Flex>
		</Card>
	);
}

export function PrivacyRequiredCard({
	feature,
	title,
	description,
}: {
	feature: PrivacyFeature;
	title: string;
	description: string;
}) {
	const requestConsent = usePrivacyGate();
	return (
		<Card variant="surface" style={{ padding: 20 }}>
			<Flex direction="column" gap="3">
				<Heading size="3">{title}</Heading>
				<Text size="2" color="gray">
					{description}
				</Text>
				<Text size="2">
					This feature cannot connect until you review and accept the current
					privacy policy and terms for{" "}
					<strong>{PRIVACY_FEATURE_LABEL[feature]}</strong>.
				</Text>
				<Flex gap="2" wrap="wrap" align="center">
					<Button
						type="button"
						onClick={() =>
							requestConsent(
								feature,
								() => {},
								"This feature sends data outside this installation.",
							)
						}
					>
						Review and accept
					</Button>
					<PrivacyConsentLinks />
				</Flex>
			</Flex>
		</Card>
	);
}
