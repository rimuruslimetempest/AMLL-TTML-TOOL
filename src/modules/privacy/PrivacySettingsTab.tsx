import {
	cloudFileManagerInitialTabAtom,
	cloudFileManagerOpenAtom,
	currentUserAtom,
} from "$/modules/cloud/states";
import { signOutUser } from "$/modules/cloud/auth";
import { collabClient } from "$/modules/collab/client";
import {
	AlertDialog,
	Badge,
	Button,
	Card,
	Code,
	Flex,
	Heading,
	Separator,
	Text,
} from "@radix-ui/themes";
import { REPORT_EMAIL } from "$/config/links";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { toast } from "react-toastify";
import { hasFeatureConsent, writeConsentRecord } from "./consent";
import {
	PRIVACY_FEATURE_LABEL,
	PRIVACY_POLICY_UPDATED,
	PRIVACY_POLICY_VERSION,
} from "./constants";
import { syncDiagnosticsReporting } from "./diagnostics";
import { CrashReportSettings } from "./CrashReportSettings";
import { clearLocalAppData } from "./localData";
import {
	PrivacyConsentLinks,
	PrivacyRequiredCard,
} from "./PrivacyDialogs";
import {
	diagnosticsOptInAtom,
	privacyConsentAtom,
} from "./states";
import { usePrivacyGate } from "./usePrivacyGate";

const formatDate = (value?: string) => {
	if (!value) return "Not accepted";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
};

export function PrivacySettingsTab() {
	const consent = useAtomValue(privacyConsentAtom);
	const setConsent = useSetAtom(privacyConsentAtom);
	const user = useAtomValue(currentUserAtom);
	const setUser = useSetAtom(currentUserAtom);
	const setCloudFileManagerOpen = useSetAtom(cloudFileManagerOpenAtom);
	const setCloudFileManagerTab = useSetAtom(cloudFileManagerInitialTabAtom);
	const [, setDiagnosticsOptIn] = useAtom(diagnosticsOptInAtom);
	const requestConsent = usePrivacyGate();
	const [withdrawOpen, setWithdrawOpen] = useState(false);
	const [clearOpen, setClearOpen] = useState(false);
	const [withdrawing, setWithdrawing] = useState(false);
	const [clearing, setClearing] = useState(false);

	const cloudAccepted = hasFeatureConsent(consent, "cloud");
	const liveAccepted = hasFeatureConsent(consent, "live");

	const withdrawConsent = async () => {
		setWithdrawing(true);
		try {
			try {
				collabClient.stop();
			} catch {
				// No room is open.
			}
			if (cloudAccepted) {
				try {
					await signOutUser();
				} catch {
					// Clearing consent still prevents new cloud initialization.
				}
			}
			writeConsentRecord(null);
			setConsent(null);
			setUser(null);
			setDiagnosticsOptIn(false);
			syncDiagnosticsReporting(false);
			toast.info("Consent withdrawn. Live and cloud features are paused.");
		} finally {
			setWithdrawing(false);
			setWithdrawOpen(false);
		}
	};

	const clearLocalData = async () => {
		setClearing(true);
		try {
			try {
				collabClient.stop();
			} catch {
				// No room is open.
			}
			await clearLocalAppData();
			window.location.reload();
		} catch {
			setClearing(false);
			setClearOpen(false);
			toast.error("Could not clear all local data. Close other app windows and retry.");
		}
	};

	const openCloudDeletionInstructions = () => {
		requestConsent("cloud", () => {
			setCloudFileManagerTab("open");
			setCloudFileManagerOpen(true);
		});
	};

	return (
		<Flex direction="column" gap="4">
			<Card variant="surface" style={{ padding: 18 }}>
				<Flex direction="column" gap="3">
					<Flex align="center" gap="2" wrap="wrap">
						<Heading size="3">Consent status</Heading>
						<Badge
							color={cloudAccepted || liveAccepted ? "green" : "gray"}
							variant="soft"
						>
							{cloudAccepted || liveAccepted ? "Active" : "Not accepted"}
						</Badge>
					</Flex>
					<Text size="2" color="gray">
						This installation records feature-specific consent for privacy
						policy version {PRIVACY_POLICY_VERSION}, effective{" "}
						{PRIVACY_POLICY_UPDATED}. A new version asks again before the
						feature reconnects.
					</Text>
					<Separator size="4" />
					<Flex direction="column" gap="2">
						<Flex justify="between" gap="3" wrap="wrap">
							<Text size="2">{PRIVACY_FEATURE_LABEL.live}</Text>
							<Text size="2" color={liveAccepted ? "green" : "gray"}>
								{liveAccepted
									? `Accepted ${formatDate(consent?.features.live?.acceptedAt)}`
									: "Not accepted"}
							</Text>
						</Flex>
						<Flex justify="between" gap="3" wrap="wrap">
							<Text size="2">{PRIVACY_FEATURE_LABEL.cloud}</Text>
							<Text size="2" color={cloudAccepted ? "green" : "gray"}>
								{cloudAccepted
									? `Accepted ${formatDate(consent?.features.cloud?.acceptedAt)}`
									: "Not accepted"}
							</Text>
						</Flex>
					</Flex>
					<Flex gap="2" wrap="wrap" align="center">
						<Button
							type="button"
							color="red"
							variant="soft"
							disabled={!cloudAccepted && !liveAccepted}
							onClick={() => setWithdrawOpen(true)}
						>
							Withdraw consent
						</Button>
						<PrivacyConsentLinks />
					</Flex>
					<Text size="1" color="gray">
						Withdrawal leaves any live room, signs out of cloud features, turns
						off diagnostics, and blocks new cloud and room connections until
						you agree again. It does not delete local project files or cloud
						data already stored.
					</Text>
				</Flex>
			</Card>

			<CrashReportSettings />

			<Card variant="surface" style={{ padding: 18 }}>
				<Flex direction="column" gap="3">
					<Heading size="3">Delete your data</Heading>
					<Text size="2" color="gray">
						Cloud files and local files are separate. Deleting one does not
						delete the other.
					</Text>
					<Separator size="4" />
					<Flex direction="column" gap="1">
						<Text size="2" weight="medium">
							Cloud library
						</Text>
						<Text size="2" color="gray">
							Delete cloud songs individually in the cloud library. This also
							removes their stored audio where the app created it. Published
							items may need to be unpublished or deleted from the community
							library separately.
						</Text>
						<Flex gap="2" wrap="wrap" mt="1">
							<Button
								type="button"
								variant="soft"
								onClick={openCloudDeletionInstructions}
							>
								Open cloud library
							</Button>
						</Flex>
					</Flex>
					<Separator size="4" />
					<Flex direction="column" gap="1">
						<Text size="2" weight="medium">
							Account and profile
						</Text>
						<Text size="2" color="gray">
							This build does not have a self-service account-deletion button.
							To request deletion of your Firebase Auth account, profile,
							avatars, and remaining cloud records, email{" "}
							<a href={`mailto:${REPORT_EMAIL}`}>
								{REPORT_EMAIL}
							</a>{" "}
							from the account's
							email address. Include your display name and user ID
							{user?.uid ? ` (${user.uid})` : ""}. Backup copies may remain
							until the provider's backup retention period expires.
						</Text>
					</Flex>
					<Separator size="4" />
					<Flex direction="column" gap="1">
						<Text size="2" weight="medium">
							This installation
						</Text>
						<Text size="2" color="gray">
							Clears projects and autosaves, cached audio, settings,
							keybindings, custom backgrounds, imported API keys, local cloud
							caches, diagnostics preference, and consent state. It does not
							delete Firebase data or files you exported elsewhere.
						</Text>
						<Flex gap="2" wrap="wrap" mt="1">
							<Button
								type="button"
								color="red"
								variant="soft"
								onClick={() => setClearOpen(true)}
								disabled={clearing}
							>
								Clear local data…
							</Button>
						</Flex>
					</Flex>
				</Flex>
			</Card>

			<Card variant="surface" style={{ padding: 18 }}>
				<Flex direction="column" gap="2">
					<Heading size="3">Data inventory</Heading>
					<Text size="2" color="gray">
						Local projects and settings stay in this installation. Live rooms
						are temporary and visible to everyone with the link. Cloud accounts
						use Firebase. AI review sends lyrics to the endpoint you configure.
						Search and import features contact the providers you select.
						Diagnostics are optional. See the policy for the complete list,
						retention details, and open TODOs.
					</Text>
					<Code size="1" variant="ghost">
						amll_privacy_consent · amll_diagnostics_opt_in ·
						amll-autosave-db · amll-custom-background
					</Code>
					<PrivacyConsentLinks />
				</Flex>
			</Card>

			{!cloudAccepted && (
				<PrivacyRequiredCard
					feature="cloud"
					title="Cloud is paused"
					description="Sign-in, cloud saves, cloud audio, and profile sync stay offline until you accept the current policy."
				/>
			)}

			<AlertDialog.Root open={withdrawOpen} onOpenChange={setWithdrawOpen}>
				<AlertDialog.Content maxWidth="460px">
					<AlertDialog.Title>Withdraw privacy consent?</AlertDialog.Title>
					<AlertDialog.Description size="2">
						You will leave any live room, be signed out of cloud features, and
						diagnostics will be turned off. Cloud and live features will stay
						paused until you review and accept the policy again. Local project
						files and data already stored in Firebase are not deleted.
					</AlertDialog.Description>
					<Flex gap="3" mt="4" justify="end">
						<AlertDialog.Cancel>
							<Button variant="soft" color="gray" disabled={withdrawing}>
								Cancel
							</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action>
							<Button
								color="red"
								onClick={() => void withdrawConsent()}
								disabled={withdrawing}
								loading={withdrawing}
							>
								Withdraw consent
							</Button>
						</AlertDialog.Action>
					</Flex>
				</AlertDialog.Content>
			</AlertDialog.Root>

			<AlertDialog.Root open={clearOpen} onOpenChange={setClearOpen}>
				<AlertDialog.Content maxWidth="480px">
					<AlertDialog.Title>Clear all local data?</AlertDialog.Title>
					<AlertDialog.Description size="2">
						This permanently deletes autosaves, projects stored by the app,
						cached audio, settings, keybindings, custom backgrounds, API keys,
						local cloud caches, and the consent record from this installation,
						then reloads the app. Cloud songs and account data are not deleted.
						Export anything you want to keep first.
					</AlertDialog.Description>
					<Flex gap="3" mt="4" justify="end">
						<AlertDialog.Cancel>
							<Button variant="soft" color="gray" disabled={clearing}>
								Cancel
							</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action>
							<Button
								color="red"
								onClick={() => void clearLocalData()}
								disabled={clearing}
								loading={clearing}
							>
								Clear and reload
							</Button>
						</AlertDialog.Action>
					</Flex>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Flex>
	);
}
