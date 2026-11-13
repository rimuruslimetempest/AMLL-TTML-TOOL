import {
	Bug16Regular,
	Copy16Regular,
	Delete16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Switch,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { toast } from "react-toastify";
import {
	clearLastCrashReport,
	crashReportEndpoint,
	crashReportText,
	readLastCrashReport,
} from "./crash";
import { syncDiagnosticsReporting } from "./diagnostics";
import { diagnosticsOptInAtom } from "./states";

export function CrashReportSettings() {
	const [optIn, setOptIn] = useAtom(diagnosticsOptInAtom);
	const [report, setReport] = useState(() => readLastCrashReport());
	const endpoint = crashReportEndpoint();

	return (
		<Card id="privacy-crash-reports">
			<Flex direction="column" gap="2">
				<Flex align="center" justify="between" gap="3">
					<Flex align="center" gap="2">
						<Bug16Regular />
						<Box>
							<Text weight="bold" as="div">
								Crash reports
							</Text>
							<Text size="1" color="gray" as="div">
								Off by default. Technical error details only; never lyrics,
								audio, project files, names, or room content.
							</Text>
						</Box>
					</Flex>
					<Switch
						checked={optIn}
						onCheckedChange={(value) => {
							setOptIn(value);
							syncDiagnosticsReporting(value);
						}}
					/>
				</Flex>
				<Flex gap="1" wrap="wrap">
					<Badge size="1" variant="soft" color={endpoint ? "blue" : "gray"}>
						{endpoint
							? "Sends to the destination configured for this build"
							: "No destination configured: local copy only"}
					</Badge>
					{report ? (
						<Badge size="1" variant="soft" color="amber">
							One local report saved
						</Badge>
					) : (
						<Badge size="1" variant="soft" color="gray">
							No saved crash report
						</Badge>
					)}
				</Flex>
				{report ? (
					<Box>
						<Text size="1" color="gray" as="div">
							{new Date(report.at).toLocaleString()} · {report.message}
						</Text>
						<Flex gap="1" mt="2" wrap="wrap">
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={async () => {
									try {
										await navigator.clipboard.writeText(crashReportText(report));
										toast.success("Crash report copied");
									} catch {
										toast.error("Couldn't copy the report.");
									}
								}}
							>
								<Copy16Regular /> Copy report
							</Button>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={() => {
									clearLastCrashReport();
									setReport(null);
									toast.success("Local crash report deleted");
								}}
							>
								<Delete16Regular /> Delete
							</Button>
						</Flex>
					</Box>
				) : null}
				<Text size="1" color="gray">
					Reports are requested once, in plain language, after a crash. You can
					change this setting at any time. With no destination configured, the
					report is only stored in this installation until you delete it.
				</Text>
			</Flex>
		</Card>
	);
}
