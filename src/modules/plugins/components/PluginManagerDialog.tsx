import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
	Button,
	Flex,
	Text,
	Card,
	Switch,
	Box,
	Grid,
	Tabs,
	Badge,
	Spinner,
	Popover,
	Dialog,
} from "@radix-ui/themes";
import {
	Dismiss16Regular as Cross2Icon,
	Add16Regular as PlusIcon,
	Delete16Regular as TrashIcon,
	ArrowUpload16Regular as UploadIcon,
	ShoppingBag16Regular as StoreIcon,
	CloudArrowDown16Regular as DownloadIcon,
	Info16Regular as InfoIcon,
	Search16Regular as SearchIcon,
	ShieldCheckmark16Regular as ShieldIcon,
} from "@fluentui/react-icons";
import {
	getAllPlugins,
	savePlugin,
	deletePlugin,
	togglePlugin,
} from "../plugin-store";
import type { PluginPermission, PluginSlot, WASMPlugin } from "../types";
import { pluginManager } from "../plugin-manager";
import { OFFICIAL_PLUGIN_REGISTRY, fetchRemoteRegistry } from "../registry";
import type { PluginRegistryEntry } from "../registry";
import styles from "./PluginManager.module.css";

const PERMISSION_LABELS: Record<PluginPermission, string> = {
	"lyrics:read": "Read lyrics",
	"lyrics:write": "Change lyrics",
	"files:read": "Read files",
	"files:write": "Write files",
	network: "Network",
	"settings:read": "Read settings",
	"ui:toolbar": "Toolbar button",
	"ui:panel": "Side panel",
};

function compareVersions(a: string, b: string): number {
	const left = a.split(/[-+]/)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
	const right = b.split(/[-+]/)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference > 0 ? 1 : -1;
	}
	return 0;
}

export const PluginManagerDialog: FC = () => {
	const { t } = useTranslation();
	const [plugins, setPlugins] = useState<WASMPlugin[]>([]);
	const [activeTab, setActiveTab] = useState("installed");
	const [installingId, setInstallingId] = useState<string | null>(null);
	const [remoteRegistry, setRemoteRegistry] = useState<PluginRegistryEntry[]>(
		OFFICIAL_PLUGIN_REGISTRY,
	);
	const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [consentEntry, setConsentEntry] = useState<PluginRegistryEntry | null>(
		null,
	);

	const verifyHash = async (
		blob: Blob,
		expectedHash: string,
	): Promise<boolean> => {
		if (expectedHash === "integrated") return true;
		const buffer = await blob.arrayBuffer();
		const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		return hashHex.toLowerCase() === expectedHash.toLowerCase();
	};

	const loadPlugins = useCallback(async () => {
		const p = await getAllPlugins();
		setPlugins(p);
	}, []);

	const loadRemoteRegistry = useCallback(async () => {
		setIsLoadingRegistry(true);
		const registry = await fetchRemoteRegistry();
		setRemoteRegistry(registry);
		setIsLoadingRegistry(false);
	}, []);

	useEffect(() => {
		loadPlugins();
	}, [loadPlugins]);

	useEffect(() => {
		if (activeTab === "store") {
			loadRemoteRegistry();
		}
	}, [activeTab, loadRemoteRegistry]);

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(event.target.files ?? []);
		event.target.value = "";
		const wasm = files.find((file) => file.name.toLowerCase().endsWith(".wasm"));
		if (!wasm) {
			window.alert("Choose a .wasm plugin (optionally with its plugin.json manifest).");
			return;
		}
		const manifestFile = files.find((file) =>
			file.name.toLowerCase().endsWith(".json"),
		);
		let manifest: Partial<WASMPlugin> = {};
		if (manifestFile) {
			try {
				const parsed = JSON.parse(await manifestFile.text()) as Record<
					string,
					unknown
				>;
				const allowedPermissions = new Set<PluginPermission>([
					"lyrics:read",
					"lyrics:write",
					"files:read",
					"files:write",
					"network",
					"settings:read",
					"ui:toolbar",
					"ui:panel",
				]);
				const allowedSlots = new Set<PluginSlot>([
					"toolbar",
					"panel",
					"import-dialog",
					"export-dialog",
				]);
				manifest = {
					id: typeof parsed.id === "string" ? parsed.id : undefined,
					name: typeof parsed.name === "string" ? parsed.name : undefined,
					description:
						typeof parsed.description === "string"
							? parsed.description
							: undefined,
					author: typeof parsed.author === "string" ? parsed.author : undefined,
					version:
						typeof parsed.version === "string" ? parsed.version : undefined,
					type:
						parsed.type === "importer" ||
						parsed.type === "exporter" ||
						parsed.type === "tool" ||
						parsed.type === "both"
							? parsed.type
							: undefined,
					apiVersion:
						parsed.apiVersion === 2 ? 2 : undefined,
					permissions: Array.isArray(parsed.permissions)
						? parsed.permissions.filter(
								(permission): permission is PluginPermission =>
									typeof permission === "string" &&
									allowedPermissions.has(permission as PluginPermission),
							)
						: undefined,
					slots: Array.isArray(parsed.slots)
						? parsed.slots.filter(
								(slot): slot is PluginSlot =>
									typeof slot === "string" &&
									allowedSlots.has(slot as PluginSlot),
							)
						: undefined,
					homepage:
						typeof parsed.homepage === "string" ? parsed.homepage : undefined,
				};
			} catch {
				window.alert("The plugin.json manifest is not valid JSON.");
				return;
			}
		}

		const plugin: WASMPlugin = {
			id: manifest.id ?? crypto.randomUUID(),
			name: manifest.name ?? wasm.name.replace(/\.wasm$/i, ""),
			description: manifest.description ?? "Community provided plugin",
			author: manifest.author ?? "Unknown",
			version: manifest.version ?? "1.0.0",
			type: manifest.type ?? "importer",
			apiVersion: manifest.apiVersion,
			permissions: manifest.permissions,
			slots: manifest.slots,
			homepage: manifest.homepage,
			blob: wasm,
			isEnabled: true,
			createdAt: Date.now(),
		};

		await savePlugin(plugin);
		await loadPlugins();
		await pluginManager.loadEnabledPlugins();
	};

	const handleDelete = async (id: string) => {
		await deletePlugin(id);
		pluginManager.unloadPlugin(id);
		await loadPlugins();
	};

	const handleToggle = async (id: string, enabled: boolean) => {
		await togglePlugin(id, enabled);
		if (!enabled) pluginManager.unloadPlugin(id);
		await loadPlugins();
		await pluginManager.loadEnabledPlugins();
	};

	const isWasm = async (blob: Blob): Promise<boolean> => {
		const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
		return (
			bytes.length === 4 &&
			bytes[0] === 0x00 &&
			bytes[1] === 0x61 &&
			bytes[2] === 0x73 &&
			bytes[3] === 0x6d
		);
	};

	const handleInstall = async (entry: PluginRegistryEntry) => {
		setInstallingId(entry.id);
		try {
			let blob: Blob;
			if (!entry.isIntegrated) {
				try {
					const res = await fetch(entry.downloadUrl);
					if (!res.ok) throw new Error("Network response was not ok");
					blob = await res.blob();

					// Verify Integrity
					const isValid = await verifyHash(blob, entry.sha256);
					if (!isValid) {
						alert(
							`Security Error: Plugin hash mismatch for ${entry.name}. The file might have been tampered with.`,
						);
						return;
					}
					if (!(await isWasm(blob))) {
						alert(
							`Security Error: ${entry.name} is not a WebAssembly module. It was not installed.`,
						);
						return;
					}
				} catch (e) {
					console.error("Download failed", e);
					alert("Failed to download plugin. Please check your connection.");
					return;
				}
			} else {
				blob = new Blob([new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])], {
					type: "application/wasm",
				});
			}

			const plugin: WASMPlugin = {
				...entry,
				blob,
				isEnabled: true,
				createdAt: Date.now(),
			};
			await savePlugin(plugin);
			await loadPlugins();
			await pluginManager.loadEnabledPlugins();
			setConsentEntry(null);
		} catch (e) {
			console.error("Installation failed", e);
		} finally {
			setInstallingId(null);
		}
	};

	const isInstalled = (id: string) => plugins.some((p) => p.id === id);
	const installedVersion = (id: string) =>
		plugins.find((plugin) => plugin.id === id)?.version;
	const updateAvailable = (entry: PluginRegistryEntry) => {
		const current = installedVersion(entry.id);
		return current ? compareVersions(entry.version, current) > 0 : false;
	};

	const filteredRegistry = remoteRegistry.filter((entry) => {
		if (typeFilter !== "all" && entry.type !== typeFilter) return false;
		const term = search.trim().toLowerCase();
		if (!term) return true;
		return [
			entry.name,
			entry.author,
			entry.description,
			...(entry.tags ?? []),
		]
			.join(" ")
			.toLowerCase()
			.includes(term);
	});

	return (
		<>
		<Dialog.Root>
			<Dialog.Trigger>
				<Button variant="soft" size="2">
					<StoreIcon /> {t("pluginManager.trigger", "Plugins")}
				</Button>
			</Dialog.Trigger>
			<Dialog.Content
				className={styles.pluginDialogContent}
				maxWidth="750px"
				style={{ minHeight: "650px", display: "flex", flexDirection: "column" }}
			>
				<Flex justify="between" align="center" mb="6">
					<Box>
						<Dialog.Title
							style={{
								fontSize: "1.5rem",
								fontWeight: "bold",
								margin: 0,
								color: "white",
							}}
						>
							{t("pluginManager.title", "Plugin Management")}
						</Dialog.Title>
						<Text
							size="3"
							style={{ color: "#B0B0B0", marginTop: "8px", display: "block" }}
						>
							{t(
								"pluginManager.description",
								"Extend your lyric editing capabilities",
							)}
						</Text>
					</Box>
					<Dialog.Close>
						<Button variant="ghost" color="gray" size="3">
							<Cross2Icon width={24} height={24} style={{ color: "white" }} />
						</Button>
					</Dialog.Close>
				</Flex>

				<Tabs.Root
					value={activeTab}
					onValueChange={setActiveTab}
					style={{ flex: 1, display: "flex", flexDirection: "column" }}
				>
					<Tabs.List mb="6" style={{ gap: "40px" }}>
						<Tabs.Trigger value="installed">
							{t("pluginManager.installed", "Installed")}
						</Tabs.Trigger>
						<Tabs.Trigger value="store">
							<Flex align="center" gap="2">
								{t("pluginManager.store", "Plugin Store")}
								{isLoadingRegistry && <Spinner size="1" />}
							</Flex>
						</Tabs.Trigger>
					</Tabs.List>

					<Box
						style={{
							flex: 1,
							overflowY: "auto",
							margin: "0 -8px",
							padding: "0 8px",
						}}
					>
						<Tabs.Content value="installed">
							<Flex direction="column" gap="5">
								{plugins.length === 0 && (
									<Flex
										direction="column"
										align="center"
										justify="center"
										py="9"
										gap="5"
										style={{
											border: "2px dashed rgba(255, 255, 255, 0.1)",
											borderRadius: "20px",
										}}
									>
										<PlusIcon
											width={56}
											height={56}
											style={{ color: "rgba(255,255,255,0.4)" }}
										/>
										<Text size="3" style={{ color: "#808080" }}>
											{t("pluginManager.empty", "No plugins installed")}
										</Text>
										<Button
											variant="soft"
											size="2"
											onClick={() => setActiveTab("store")}
										>
											{t("pluginManager.browse", "Browse Store")}
										</Button>
									</Flex>
								)}
								{plugins.map((plugin) => (
									<Card key={plugin.id} className={styles.pluginStoreCard}>
										<Flex justify="between" align="center" p="1">
											<Box>
												<Flex align="center" gap="3" mb="1">
													<Text
														weight="bold"
														size="4"
														style={{ color: "white" }}
													>
														{plugin.name}
													</Text>
													<Badge variant="soft">v{plugin.version}</Badge>
												</Flex>
												<Text size="2" style={{ color: "#B0B0B0" }}>
													by {plugin.author}
												</Text>
											</Box>
											<Flex gap="3" align="center">
												<Popover.Root>
													<Popover.Trigger>
														<Button variant="ghost" color="gray" size="1">
															<InfoIcon width={18} height={18} />
														</Button>
													</Popover.Trigger>
													<Popover.Content className={styles.customPopover}>
														<Flex direction="column" gap="4">
															<Box>
																<Text
																	size="3"
																	weight="bold"
																	style={{ color: "white", display: "block" }}
																>
																	{plugin.name}
																</Text>
																<Text
																	size="2"
																	style={{ color: "#B0B0B0", marginTop: "4px" }}
																>
																	{plugin.description}
																</Text>
															</Box>
															{plugin.techniques && (
																<Box>
																	<Text size="2" weight="bold">
																		{t(
																			"pluginManager.techniques",
																			"Techniques",
																		)}
																	</Text>
																	<Flex gap="1" wrap="wrap" mt="1">
																		{plugin.techniques.map((t) => (
																			<Badge key={t} size="1" color="gray">
																				{t}
																			</Badge>
																		))}
																	</Flex>
																</Box>
															)}
															{plugin.usage && (
																<Box>
																	<Text size="2" weight="bold">
																		{t("pluginManager.usage", "Usage")}
																	</Text>
																	<Text
																		size="2"
																		style={{
																			color: "#E0E0E0",
																			whiteSpace: "pre-line",
																		}}
																	>
																		{plugin.usage}
																	</Text>
																</Box>
															)}
														</Flex>
													</Popover.Content>
												</Popover.Root>
												<Switch
													checked={plugin.isEnabled}
													onCheckedChange={(v) => handleToggle(plugin.id, v)}
												/>
												<Button
													variant="soft"
													color="red"
													size="1"
													onClick={() => handleDelete(plugin.id)}
												>
													<TrashIcon />
												</Button>
											</Flex>
										</Flex>
									</Card>
								))}
								<label
									className={styles.sideloadZone}
									style={{
										display: "flex",
										flexDirection: "column",
										height: "100px",
										borderRadius: "20px",
										cursor: "pointer",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Flex align="center" gap="2">
										<UploadIcon />{" "}
										<Text size="3">
											{t(
												"pluginManager.sideload",
												"Sideload .wasm + plugin.json",
											)}
										</Text>
									</Flex>
									<input
										type="file"
										accept=".wasm,.json"
										multiple
										style={{ display: "none" }}
										onChange={handleFileUpload}
									/>
								</label>
							</Flex>
						</Tabs.Content>
						<Tabs.Content value="store">
							<Flex gap="3" mb="4" wrap="wrap" align="end">
								<Box style={{ flex: "1 1 220px", minWidth: 0 }}>
									<Text size="1" color="gray" weight="bold" as="div" mb="1">
										<SearchIcon /> Search
									</Text>
									<input
										type="search"
										value={search}
										onChange={(event) => setSearch(event.target.value)}
										placeholder="Name, author, description, or tag"
										aria-label="Search community plugins"
										style={{
											width: "100%",
											height: 34,
											padding: "0 10px",
											borderRadius: 7,
											border: "1px solid var(--gray-a6)",
											background: "var(--gray-a2)",
											color: "var(--gray-12)",
										}}
									/>
								</Box>
								<Box>
									<Text size="1" color="gray" weight="bold" as="div" mb="1">
										Type
									</Text>
									<select
										value={typeFilter}
										onChange={(event) => setTypeFilter(event.target.value)}
										aria-label="Filter plugins by type"
										style={{
											height: 34,
											borderRadius: 7,
											border: "1px solid var(--gray-a6)",
											background: "var(--gray-a2)",
											color: "var(--gray-12)",
										}}
									>
										<option value="all">All types</option>
										<option value="importer">Importer</option>
										<option value="exporter">Exporter</option>
										<option value="tool">Lyric tool</option>
										<option value="both">Importer and exporter</option>
									</select>
								</Box>
							</Flex>
							{isLoadingRegistry && remoteRegistry.length === 0 ? (
								<Flex
									direction="column"
									align="center"
									justify="center"
									py="9"
									gap="3"
								>
									<Spinner size="3" />
									<Text size="2" color="gray">
										{t("pluginManager.loading", "Loading community plugins...")}
									</Text>
								</Flex>
							) : (
								<>
									{filteredRegistry.length === 0 ? (
										<Card>
											<Text size="2" color="gray">
												{remoteRegistry.length === 0
													? "No community plugins are listed yet. Reviewed plugins appear here after a merged submission."
													: "No plugins match that search and type."}
											</Text>
										</Card>
									) : null}
								<Grid columns="2" gap="4">
									{filteredRegistry.map((entry) => (
										<Card
											key={entry.id}
											className={styles.pluginStoreCard}
											style={{
												opacity:
													isInstalled(entry.id) && !updateAvailable(entry)
														? 0.6
														: 1,
											}}
										>
											<Flex
												direction="column"
												justify="between"
												style={{ height: "100%" }}
												p="1"
											>
												<Flex justify="between" align="start" mb="2">
													<Text
														weight="bold"
														size="3"
														style={{ color: "white" }}
													>
														{entry.name}
													</Text>
													{entry.verified ? (
														<Badge size="1" color="green" variant="soft">
															Verified
														</Badge>
													) : (
														<Badge size="1" color="gray" variant="soft">
															Community
														</Badge>
													)}
													{entry.deprecated ? (
														<Badge size="1" color="red" variant="soft">
															Deprecated
														</Badge>
													) : null}
													{updateAvailable(entry) ? (
														<Badge size="1" color="amber" variant="soft">
															Update
														</Badge>
													) : null}
													<Popover.Root>
														<Popover.Trigger>
															<Button variant="ghost" color="gray" size="1">
																<InfoIcon />
															</Button>
														</Popover.Trigger>
														<Popover.Content className={styles.customPopover}>
															<Flex direction="column" gap="3">
																<Text weight="bold" color="white">
																	{entry.name} Details
																</Text>
																<Text size="2" style={{ color: "#B0B0B0" }}>
																	{entry.description}
																</Text>
																{entry.usage && (
																	<Text
																		size="2"
																		style={{ whiteSpace: "pre-line" }}
																	>
																		{entry.usage}
																	</Text>
																)}
															</Flex>
														</Popover.Content>
													</Popover.Root>
												</Flex>
												<Text
													size="2"
													mb="3"
													style={{
														color: "#B0B0B0",
														height: "3em",
														overflow: "hidden",
													}}
												>
													{entry.description}
												</Text>
												<Flex gap="1" wrap="wrap">
													{(entry.permissions ?? []).length === 0 ? (
														<Badge size="1" color="gray">
															No permissions declared
														</Badge>
													) : (
														(entry.permissions ?? []).map((permission) => (
															<Badge key={permission} size="1" color="blue" variant="soft">
																{PERMISSION_LABELS[permission] ?? permission}
															</Badge>
														))
													)}
												</Flex>
												<Flex justify="between" align="center">
													<Text size="1" color="gray">
														by {entry.author}
													</Text>
													{(!isInstalled(entry.id) || updateAvailable(entry)) &&
													!entry.deprecated && (
														<Button
															size="2"
															variant="soft"
															onClick={() => setConsentEntry(entry)}
															disabled={installingId === entry.id}
														>
															{installingId === entry.id ? (
																<Spinner />
															) : (
																<>
																	<DownloadIcon />{" "}
																	{updateAvailable(entry)
																		? t("pluginManager.update", "Update")
																		: t("pluginManager.install", "Install")}
																</>
															)}
														</Button>
													)}
												</Flex>
											</Flex>
										</Card>
									))}
								</Grid>
								</>
							)}
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
		<Dialog.Root
			open={consentEntry !== null}
			onOpenChange={(next) => {
				if (!next) setConsentEntry(null);
			}}
		>
			<Dialog.Content maxWidth="520px">
				{consentEntry ? (
					<Flex direction="column" gap="4">
						<Box>
							<Dialog.Title style={{ margin: 0 }}>
								Install {consentEntry.name}?
							</Dialog.Title>
							<Dialog.Description size="2" color="gray" mt="1">
								by {consentEntry.author} · v{consentEntry.version}
							</Dialog.Description>
						</Box>
						<Text size="2">{consentEntry.description}</Text>
						<Box>
							<Flex align="center" gap="2">
								<ShieldIcon />
								<Text size="2" weight="bold">
									This plugin declares
								</Text>
							</Flex>
							<Flex gap="1" wrap="wrap" mt="2">
								{(consentEntry.permissions ?? []).length === 0 ? (
									<Badge size="1" color="gray">
										No permissions
									</Badge>
								) : (
									(consentEntry.permissions ?? []).map((permission) => (
										<Badge
											key={permission}
											size="1"
											color="blue"
											variant="soft"
										>
											{PERMISSION_LABELS[permission] ?? permission}
										</Badge>
									))
								)}
							</Flex>
						</Box>
						<Text size="1" color="gray">
							The app verifies the published SHA-256 and the WebAssembly header
							before installing. This plugin cannot read the page, your files,
							or the network beyond the permissions above.
						</Text>
						<Flex gap="2" justify="end">
							<Button
								variant="soft"
								onClick={() => setConsentEntry(null)}
							>
								Cancel
							</Button>
							<Button
								onClick={() => void handleInstall(consentEntry)}
								disabled={installingId === consentEntry.id}
							>
								{installingId === consentEntry.id ? (
									<Spinner />
								) : (
									<>
										<DownloadIcon />{" "}
										{updateAvailable(consentEntry)
											? t("pluginManager.update", "Update")
											: t("pluginManager.install", "Install")}
									</>
								)}
							</Button>
						</Flex>
					</Flex>
				) : null}
			</Dialog.Content>
		</Dialog.Root>
		</>
	);
};
