import {
	Checkbox,
	Dialog,
	Flex,
	Progress,
	SegmentedControl,
	Select,
	Slider,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { uid } from "uid";
import { Density, PerformanceMode } from "$/design-system/types";
import { audioEngine } from "$/modules/audio/audio-engine";
import { collabNameAtom } from "$/modules/collab/states";
import { startBeginnerGuide } from "$/modules/onboarding/BeginnerGuide";
import {
	guideExportedAtom,
	guidePanelOpenAtom,
	guideStepAtom,
} from "$/modules/onboarding/states";
import {
	diagnosticsOptInAtom,
	privacyPolicyDialogAtom,
	termsDialogAtom,
} from "$/modules/privacy/states";
import {
	densityAtom,
	newAccentColorAtom,
	performanceModePreferenceAtom,
	uiScaleAtom,
} from "$/modules/settings/states";
import { latencyTestDialogAtom } from "$/states/dialogs";
import { keySyncStartAtom } from "$/states/keybindings";
import {
	DarkMode,
	darkModeAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { formatKeyBindings, recordShortcut } from "$/utils/keybindings";
import styles from "./SetupWizard.module.css";
import {
	hasLegacyAppData,
	setupCompletedAtom,
	setupOutputDeviceAtom,
	setupWizardOpenAtom,
} from "./states";

const ACCENTS = [
	["ruby", "#e5484d"],
	["orange", "#f76b15"],
	["amber", "#ffb224"],
	["grass", "#46a758"],
	["teal", "#12a594"],
	["blue", "#0090ff"],
	["violet", "#6e56cf"],
	["pink", "#d6409f"],
] as const;

const STEP_TITLES = [
	"Welcome",
	"Display name",
	"Appearance",
	"Audio",
	"Performance",
	"Privacy",
	"Ready",
];

export function SetupWizard() {
	const [open, setOpen] = useAtom(setupWizardOpenAtom);
	const [completed, setCompleted] = useAtom(setupCompletedAtom);
	const [step, setStep] = useState(0);
	const [name, setName] = useAtom(collabNameAtom);
	const [darkMode, setDarkMode] = useAtom(darkModeAtom);
	const [accent, setAccent] = useAtom(newAccentColorAtom);
	const [density, setDensity] = useAtom(densityAtom);
	const [uiScale, setUiScale] = useAtom(uiScaleAtom);
	const [performance, setPerformance] = useAtom(performanceModePreferenceAtom);
	const [diagnosticsOptIn, setDiagnosticsOptIn] = useAtom(diagnosticsOptInAtom);
	const [outputDevice, setOutputDevice] = useAtom(setupOutputDeviceAtom);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [tapKey, setTapKey] = useAtom(keySyncStartAtom);
	const [capturingKey, setCapturingKey] = useState(false);
	const [fps, setFps] = useState<number | null>(null);
	const [checkingFps, setCheckingFps] = useState(false);
	const [privacyOpen, setPrivacyOpen] = useAtom(privacyPolicyDialogAtom);
	const [termsOpen, setTermsOpen] = useAtom(termsDialogAtom);
	const setLatencyOpen = useSetAtom(latencyTestDialogAtom);
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setToolMode = useSetAtom(toolModeAtom);
	const setGuidePanel = useSetAtom(guidePanelOpenAtom);
	const setGuideStep = useSetAtom(guideStepAtom);
	const setGuideExported = useSetAtom(guideExportedAtom);
	const lyrics = useAtomValue(lyricLinesAtom);

	useEffect(() => {
		if (completed) return;
		// An update from an older build already has user settings stored, so
		// mark setup complete instead of showing first-run onboarding.
		if (hasLegacyAppData()) {
			setCompleted(true);
			return;
		}
		setOpen(true);
	}, [completed, setCompleted, setOpen]);

	useEffect(() => {
		if (!open || step !== 3) return;
		if (!navigator.mediaDevices?.enumerateDevices) return;
		void navigator.mediaDevices
			.enumerateDevices()
			.then((list) =>
				setDevices(list.filter((device) => device.kind === "audiooutput")),
			)
			.catch(() => setDevices([]));
	}, [open, step]);

	const finish = () => {
		setCompleted(true);
		setOpen(false);
		if (outputDevice) {
			void audioEngine.setOutputDevice(outputDevice);
		}
	};

	const skip = () => finish();

	const next = () => setStep((current) => Math.min(6, current + 1));
	const back = () => setStep((current) => Math.max(0, current - 1));

	const testTone = async () => {
		try {
			const context = new AudioContext();
			const sinkContext = context as AudioContext & {
				setSinkId?: (id: string) => Promise<void>;
			};
			if (outputDevice && sinkContext.setSinkId) {
				await sinkContext.setSinkId(outputDevice).catch(() => {});
			}
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			gain.gain.value = 0.08;
			oscillator.frequency.value = 440;
			oscillator.connect(gain).connect(context.destination);
			oscillator.start();
			oscillator.stop(context.currentTime + 0.35);
			oscillator.addEventListener("ended", () => {
				void context.close();
			});
		} catch {
			toast.error("The test tone could not be played.");
		}
	};

	const changeTapKey = async () => {
		setCapturingKey(true);
		try {
			const nextKey = await recordShortcut();
			if (nextKey.length > 0) setTapKey(nextKey);
		} finally {
			setCapturingKey(false);
		}
	};

	const checkFrameRate = async () => {
		setCheckingFps(true);
		const start = performance.now();
		let frames = 0;
		await new Promise<void>((resolve) => {
			const tick = (now: number) => {
				frames++;
				if (now - start >= 1200) resolve();
				else requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		const measured = Math.round((frames * 1000) / (performance.now() - start));
		setFps(measured);
		setCheckingFps(false);
	};

	const startNewProject = () => {
		setNewLyricLines({ metadata: [], lyricLines: [] });
		setSaveFileName("untitled.ttml");
		setProjectId(uid());
		setToolMode(ToolMode.Edit);
		finish();
	};

	const openGuide = () => {
		startBeginnerGuide(setGuidePanel, setGuideStep, setGuideExported);
		finish();
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) setOpen(false);
			}}
		>
			<Dialog.Content maxWidth="600px" className={styles.dialog}>
				<Flex justify="between" align="center" gap="3">
					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							Step {step + 1} of 7 · {STEP_TITLES[step]}
						</Text>
						<Dialog.Title style={{ margin: 0 }}>
							{step === 0 ? "Welcome to TTML Tool" : STEP_TITLES[step]}
						</Dialog.Title>
					</Flex>
					<button type="button" className={styles.skip} onClick={skip}>
						Skip setup
					</button>
				</Flex>
				<Progress value={((step + 1) / 7) * 100} mt="3" />

				<div className={styles.body}>
					{step === 0 ? (
						<Flex direction="column" gap="3">
							<Text size="3">
								TTML Tool is a desktop editor for making timed TTML lyrics for
								Spicy Lyrics. Import lyrics and audio, time every word by hand,
								preview the result, and export a clean TTML.
							</Text>
							<Text size="2" color="gray">
								This short setup saves your display name and a few display and
								audio preferences. You can skip any step, and nothing is sent
								anywhere.
							</Text>
						</Flex>
					) : null}

					{step === 1 ? (
						<Flex direction="column" gap="3">
							<Text size="2">
								Choose the name shown in live rooms and shared projects. It
								stays on this device and is used again next time.
							</Text>
							<TextField.Root
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Your display name"
								autoFocus
							/>
							{!name.trim() ? (
								<Text size="1" color="amber">
									Leave this blank only if you want live rooms to call you
									Guest.
								</Text>
							) : null}
						</Flex>
					) : null}

					{step === 2 ? (
						<Flex direction="column" gap="4">
							<Flex justify="between" align="center" gap="3" wrap="wrap">
								<Text size="2">Theme</Text>
								<SegmentedControl.Root
									value={darkMode}
									onValueChange={(value) => setDarkMode(value as DarkMode)}
								>
									<SegmentedControl.Item value={DarkMode.Dark}>
										Dark
									</SegmentedControl.Item>
									<SegmentedControl.Item value={DarkMode.Light}>
										Light
									</SegmentedControl.Item>
									<SegmentedControl.Item value={DarkMode.Auto}>
										Follow system
									</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
							<Flex direction="column" gap="2">
								<Text size="2">Accent color</Text>
								<Flex gap="2" wrap="wrap">
									{ACCENTS.map(([colorName, hex]) => (
										<button
											key={colorName}
											type="button"
											aria-label={colorName}
											title={colorName}
											className={
												accent === colorName
													? styles.accentActive
													: styles.accent
											}
											style={{ background: hex }}
											onClick={() => setAccent(colorName)}
										/>
									))}
								</Flex>
							</Flex>
							<Flex justify="between" align="center" gap="3" wrap="wrap">
								<Text size="2">Density</Text>
								<SegmentedControl.Root
									value={density}
									onValueChange={(value) => setDensity(value as Density)}
								>
									<SegmentedControl.Item value={Density.Comfortable}>
										Comfortable
									</SegmentedControl.Item>
									<SegmentedControl.Item value={Density.Compact}>
										Compact
									</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
							<Flex direction="column" gap="2">
								<Flex justify="between">
									<Text size="2">Interface scale</Text>
									<Text size="2" color="gray">
										{uiScale}%
									</Text>
								</Flex>
								<Slider
									value={[uiScale]}
									min={80}
									max={120}
									step={5}
									onValueChange={([value]) => setUiScale(value)}
								/>
							</Flex>
						</Flex>
					) : null}

					{step === 3 ? (
						<Flex direction="column" gap="4">
							<Flex direction="column" gap="2">
								<Text size="2">Output device</Text>
								<Select.Root
									value={outputDevice || "default"}
									onValueChange={(value) =>
										setOutputDevice(value === "default" ? "" : value)
									}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value="default">System default</Select.Item>
										{devices.map((device, index) => (
											<Select.Item
												key={device.deviceId}
												value={device.deviceId}
											>
												{device.label || `Output device ${index + 1}`}
											</Select.Item>
										))}
									</Select.Content>
								</Select.Root>
								<Text size="1" color="gray">
									Device switching is applied where the desktop webview supports
									it; otherwise the system default is used.
								</Text>
								<Flex gap="2">
									<button
										type="button"
										className={styles.secondary}
										onClick={testTone}
									>
										Play test tone
									</button>
								</Flex>
							</Flex>

							<Flex justify="between" align="center" gap="3" wrap="wrap">
								<Flex direction="column" gap="1">
									<Text size="2">Tap key for syncing</Text>
									<Text size="1" color="gray">
										Currently: {formatKeyBindings(tapKey)}
									</Text>
								</Flex>
								<button
									type="button"
									className={styles.secondary}
									onClick={changeTapKey}
									disabled={capturingKey}
								>
									{capturingKey ? "Press a key…" : "Change key"}
								</button>
							</Flex>

							<Flex justify="between" align="center" gap="3" wrap="wrap">
								<Flex direction="column" gap="1">
									<Text size="2">Latency calibration</Text>
									<Text size="1" color="gray">
										Measures your audio and input delay so timing stays
										consistent.
									</Text>
								</Flex>
								<button
									type="button"
									className={styles.secondary}
									onClick={() => setLatencyOpen(true)}
								>
									Open calibration
								</button>
							</Flex>
						</Flex>
					) : null}

					{step === 4 ? (
						<Flex direction="column" gap="4">
							<Text size="2">
								Performance mode reduces expensive visual effects. Auto keeps
								the app responsive and never switches mode without your choice.
							</Text>
							<SegmentedControl.Root
								value={performance}
								onValueChange={(value) =>
									setPerformance(value as PerformanceMode)
								}
							>
								<SegmentedControl.Item value={PerformanceMode.Off}>
									Off
								</SegmentedControl.Item>
								<SegmentedControl.Item value={PerformanceMode.Auto}>
									Auto
								</SegmentedControl.Item>
								<SegmentedControl.Item value={PerformanceMode.On}>
									On
								</SegmentedControl.Item>
							</SegmentedControl.Root>
							<Flex gap="2" align="center" wrap="wrap">
								<button
									type="button"
									className={styles.secondary}
									onClick={checkFrameRate}
									disabled={checkingFps}
								>
									{checkingFps ? "Measuring…" : "Run a quick frame-rate check"}
								</button>
								{fps !== null ? (
									<Text size="2" color={fps < 45 ? "amber" : "green"}>
										{fps} FPS measured.{" "}
										{fps < 45
											? "Performance mode On is likely a better fit."
											: "Auto should be comfortable."}
									</Text>
								) : null}
							</Flex>
						</Flex>
					) : null}

					{step === 5 ? (
						<Flex direction="column" gap="3">
							<Text size="2">
								Live rooms share the project, edits, display name, chat, and any
								audio you choose to share with the host and people in the room.
								Nothing is sent just by opening this screen, and no room is
								joined automatically.
							</Text>
							<Text size="2">
								Crash reports are off by default. When enabled, reports contain
								error details and no lyrics, audio, or account data.
							</Text>
							<Flex gap="2" wrap="wrap">
								<button
									type="button"
									className={styles.secondary}
									onClick={() => setPrivacyOpen(true)}
								>
									Privacy Policy
								</button>
								<button
									type="button"
									className={styles.secondary}
									onClick={() => setTermsOpen(true)}
								>
									Terms of Use
								</button>
							</Flex>
							<Text as="label" size="2">
								<Checkbox
									checked={diagnosticsOptIn}
									onCheckedChange={(value) =>
										setDiagnosticsOptIn(value === true)
									}
								/>{" "}
								Send crash reports to help fix problems (optional, off by
								default)
							</Text>
							{privacyOpen || termsOpen ? (
								<Text size="1" color="gray">
									Close the document to return to setup.
								</Text>
							) : null}
						</Flex>
					) : null}

					{step === 6 ? (
						<Flex direction="column" gap="3">
							<Text size="2">
								Setup is complete. Your display name is{" "}
								<strong>{name.trim() || "not set"}</strong>, the interface uses{" "}
								{density} density at {uiScale}%, and performance mode is set to{" "}
								{performance}.
							</Text>
							<Text size="2" color="gray">
								You can change all of this later in Settings. The guide walks
								through importing audio, adding lyrics, syncing, checking, and
								exporting.
							</Text>
							<Flex gap="2" wrap="wrap">
								<button
									type="button"
									className={styles.primary}
									onClick={startNewProject}
									disabled={lyrics.lyricLines.length > 0}
								>
									Start a new project
								</button>
								<button
									type="button"
									className={styles.secondary}
									onClick={openGuide}
								>
									Open the guide
								</button>
							</Flex>
							{lyrics.lyricLines.length > 0 ? (
								<Text size="1" color="gray">
									A project is already open, so starting a new one is disabled
									here. Close this setup and use File → New when you are ready.
								</Text>
							) : null}
						</Flex>
					) : null}
				</div>

				<Flex justify="between" align="center" mt="4" gap="2">
					<button
						type="button"
						className={styles.secondary}
						onClick={back}
						disabled={step === 0}
					>
						Back
					</button>
					{step < 6 ? (
						<button type="button" className={styles.primary} onClick={next}>
							Next
						</button>
					) : (
						<button type="button" className={styles.primary} onClick={finish}>
							Finish
						</button>
					)}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
