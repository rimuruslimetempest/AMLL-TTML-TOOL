import { Copy16Regular, ErrorCircle16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Dialog,
	Flex,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
	clearLastCrashReport,
	crashReportEndpoint,
	crashReportText,
	readLastCrashReport,
	sendCrashReport,
	type CrashReport,
} from "./crash";
import {
	crashPromptSeenAtom,
	diagnosticsOptInAtom,
	pendingCrashReportAtom,
} from "./states";

export function CrashReportPrompt() {
	const [seen, setSeen] = useAtom(crashPromptSeenAtom);
	const optIn = useAtomValue(diagnosticsOptInAtom);
	const [pending, setPending] = useAtom(pendingCrashReportAtom);
	const [open, setOpen] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const endpoint = crashReportEndpoint();

	useEffect(() => {
		const onCrash = (event: Event) => {
			const report = (event as CustomEvent<CrashReport>).detail;
			setPending(report ?? readLastCrashReport());
		};
		window.addEventListener("ttml:crash-report", onCrash);
		const stored = readLastCrashReport();
		if (stored) setPending(stored);
		return () => window.removeEventListener("ttml:crash-report", onCrash);
	}, [setPending]);

	useEffect(() => {
		if (pending && !seen && !optIn) setOpen(true);
	}, [pending, seen, optIn]);

	const dismiss = () => {
		setOpen(false);
		setSeen(true);
	};

	const send = async () => {
		if (!pending) return;
		if (!endpoint) {
			toast.info(
				"No crash-report destination is configured in this build. The report stays on this device.",
			);
			dismiss();
			return;
		}
		const ok = await sendCrashReport(pending, endpoint);
		if (ok) toast.success("Crash report sent. Thank you.");
		else toast.error("The report could not be sent. A local copy was kept.");
		dismiss();
	};

	const copy = async () => {
		if (!pending) return;
		try {
			await navigator.clipboard.writeText(crashReportText(pending));
			toast.success("Crash report copied");
		} catch {
			toast.error("Couldn't copy the report.");
		}
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) dismiss();
			}}
		>
			<Dialog.Content maxWidth="520px">
				<Dialog.Title>
					<Flex align="center" gap="2">
						<ErrorCircle16Regular />
						Help fix this crash?
					</Flex>
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					The app hit an error. You can send a small technical report, or keep
					it on this device. Reports are off by default and never include
					lyrics, audio, project files, account details, names, IP addresses, or
					room content.
				</Dialog.Description>
				{pending ? (
					<>
						<Text size="1" color="gray" as="p">
							{pending.message} · {new Date(pending.at).toLocaleString()}
						</Text>
						<Button
							variant="soft"
							color="gray"
							size="1"
							mt="2"
							onClick={() => setShowDetails((value) => !value)}
						>
							{showDetails ? "Hide report" : "View report"}
						</Button>
						{showDetails ? (
							<pre
								style={{
									maxHeight: 200,
									overflow: "auto",
									fontSize: 11,
									padding: 10,
									marginTop: 8,
									background: "var(--gray-a3)",
									borderRadius: 8,
									whiteSpace: "pre-wrap",
								}}
							>
								{crashReportText(pending)}
							</pre>
						) : null}
						<Flex gap="1" mt="2" wrap="wrap">
							<Badge size="1" variant="soft">
								App version only
							</Badge>
							<Badge size="1" variant="soft">
								No project content
							</Badge>
							<Badge size="1" variant="soft" color={endpoint ? "blue" : "gray"}>
								{endpoint ? "Destination configured" : "Local copy only"}
							</Badge>
						</Flex>
					</>
				) : null}
				<Flex justify="end" gap="2" mt="4" wrap="wrap">
					<Button variant="ghost" color="gray" onClick={copy}>
						<Copy16Regular /> Copy
					</Button>
					<Button
						variant="soft"
						color="gray"
						onClick={() => {
							clearLastCrashReport();
							setPending(null);
							dismiss();
						}}
					>
						Delete
					</Button>
					<Button variant="soft" color="gray" onClick={dismiss}>
						Not now
					</Button>
					<Button onClick={send}>
						{endpoint ? "Send report" : "Keep local copy"}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
