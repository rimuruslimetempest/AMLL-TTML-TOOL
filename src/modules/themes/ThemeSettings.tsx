import {
	ArrowDownload24Regular,
	ArrowReset24Regular,
	ArrowUpload24Regular,
	Delete24Regular,
	Edit24Regular,
	FolderOpen24Regular,
	PaintBrush24Regular,
	Save24Regular,
	Warning24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Switch,
	Text,
} from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Dialog } from "$/design-system";
import {
	addRecycleItems,
	buildThemeRecycleItem,
	deleteRecycleItem,
	restoreRecycleItem,
	showUndoToast,
} from "$/modules/recycle-bin/actions";
import { isDarkThemeAtom } from "$/states/main";
import { BUILTIN_THEMES } from "./builtins";
import { sanitizeThemeCss } from "./css";
import {
	activeThemeAtom,
	activeThemeSchemeAtom,
	effectsSuppressedAtom,
	themeAllowRemoteContentAtom,
	themeAutoReloadAtom,
	themeCatalogAtom,
	themeCustomCssAtom,
	themeCustomCssEnabledAtom,
	themeIdAtom,
	themeReduceEffectsAtom,
	themeReloadTokenAtom,
	themeSchemeIdAtom,
	userThemesAtom,
} from "./state";
import {
	deleteUserTheme,
	installUserTheme,
	loadUserThemes,
	readThemeBundle,
	readThemeFolder,
	themeToJson,
	type ThemeAssetFile,
} from "./storage";
import {
	getContrastWarnings,
	resolveScheme,
} from "./tokens";
import {
	DEFAULT_SCHEME_ID,
	DEFAULT_THEME_ID,
	THEME_TOKEN_GROUPS,
	THEME_TOKEN_LABELS,
	type ThemePack,
	type ThemeScheme,
	type ThemeTokenKey,
	type ThemeTokenValues,
} from "./types";
import { parseTheme, sanitizeThemeId } from "./validate";
import { CommunityThemesPanel } from "./CommunityThemesPanel";

function supportsBackdrop(): boolean {
	return (
		typeof CSS !== "undefined" &&
		typeof CSS.supports === "function" &&
		CSS.supports("backdrop-filter", "blur(1px)")
	);
}

function effectLabel(theme: ThemePack): string {
	const level = theme.effects?.level ?? "none";
	if (level === "none") return "Flat";
	if (level === "light") return "Light effects";
	if (level === "medium") return "Medium effects";
	return "Glass / heavy";
}

function performanceLabel(theme: ThemePack): string {
	return theme.effects?.performance ?? "light";
}

function colorInputValue(value: string): string {
	return /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
}

function uniqueThemeId(base: string, catalog: ThemePack[]): string {
	let id = sanitizeThemeId(base);
	if (!catalog.some((theme) => theme.id === id)) return id;
	let index = 2;
	while (catalog.some((theme) => theme.id === `${id}-${index}`)) index++;
	return `${id}-${index}`;
}

function downloadJson(name: string, value: string): void {
	const blob = new Blob([value], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${name}.json`;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function ThemePreview({
	scheme,
	compact = false,
}: {
	scheme: ThemeScheme;
	compact?: boolean;
}) {
	const tokens = scheme.tokens;
	return (
		<div
			aria-hidden="true"
			style={{
				height: compact ? 78 : 124,
				borderRadius: 10,
				overflow: "hidden",
				border: `1px solid ${tokens.border}`,
				background: tokens.bgBase,
				display: "flex",
				flexDirection: "column",
				fontFamily: "var(--ttml-font-sans)",
			}}
		>
			<div
				style={{
					height: compact ? 18 : 24,
					display: "flex",
					alignItems: "center",
					gap: 5,
					padding: "0 7px",
					background: tokens.bgRaised,
					borderBottom: `1px solid ${tokens.border}`,
				}}
			>
				<span
					style={{
						width: 5,
						height: 5,
						borderRadius: 999,
						background: tokens.accent,
					}}
				/>
				<span
					style={{
						width: compact ? 32 : 52,
						height: 4,
						borderRadius: 999,
						background: tokens.textMuted,
						opacity: 0.7,
					}}
				/>
				<span
					style={{
						marginLeft: "auto",
						width: compact ? 16 : 28,
						height: 6,
						borderRadius: 999,
						background: tokens.accentSubtle,
					}}
				/>
			</div>
			<div style={{ display: "flex", flex: 1, minHeight: 0 }}>
				<div
					style={{
						width: compact ? 26 : 42,
						borderRight: `1px solid ${tokens.border}`,
						background: tokens.surface,
						padding: 5,
						display: "flex",
						flexDirection: "column",
						gap: 4,
					}}
				>
					{[0, 1, 2].map((index) => (
						<span
							key={index}
							style={{
								height: 4,
								borderRadius: 999,
								background: index === 0 ? tokens.accent : tokens.surface3,
							}}
						/>
					))}
				</div>
				<div
					style={{
						flex: 1,
						padding: compact ? 7 : 11,
						display: "flex",
						flexDirection: "column",
						gap: compact ? 5 : 7,
					}}
				>
					<span
						style={{
							width: "54%",
							height: compact ? 7 : 9,
							borderRadius: 3,
							background: tokens.text,
						}}
					/>
					<span
						style={{
							width: "78%",
							height: 4,
							borderRadius: 999,
							background: tokens.textSecondary,
							opacity: 0.8,
						}}
					/>
					<span
						style={{
							width: "64%",
							height: 4,
							borderRadius: 999,
							background: tokens.textMuted,
							opacity: 0.65,
						}}
					/>
					<div style={{ marginTop: "auto", display: "flex", gap: 4 }}>
						<span
							style={{
								width: compact ? 30 : 46,
								height: compact ? 8 : 11,
								borderRadius: 4,
								background: tokens.accent,
							}}
						/>
						<span
							style={{
								width: compact ? 18 : 30,
								height: compact ? 8 : 11,
								borderRadius: 4,
								background: tokens.surface2,
								border: `1px solid ${tokens.border}`,
							}}
						/>
					</div>
				</div>
			</div>
			<div
				style={{
					height: compact ? 9 : 13,
					display: "flex",
					gap: 3,
					alignItems: "center",
					padding: "0 7px",
					background: tokens.surface,
					borderTop: `1px solid ${tokens.border}`,
				}}
			>
				<span
					style={{
						width: 8,
						height: 8,
						borderRadius: 99,
						background: tokens.accent,
					}}
				/>
				<span
					style={{ flex: 1, height: 3, borderRadius: 99, background: tokens.surface3 }}
				/>
				<span
					style={{
						width: compact ? 20 : 34,
						height: 3,
						borderRadius: 99,
						background: tokens.accent,
					}}
				/>
			</div>
		</div>
	);
}

function TokenField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<Text size="1" color="gray" weight="bold">
				{label}
			</Text>
			<Flex gap="1" align="center">
				<input
					type="color"
					value={colorInputValue(value)}
					onChange={(event) => onChange(event.target.value)}
					aria-label={`${label} color picker`}
					style={{
						width: 28,
						height: 28,
						padding: 2,
						border: "1px solid var(--gray-a6)",
						borderRadius: 5,
						background: "transparent",
						cursor: "pointer",
						flexShrink: 0,
					}}
				/>
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					spellCheck={false}
					aria-label={label}
					style={{
						minWidth: 0,
						width: "100%",
						height: 28,
						padding: "0 6px",
						border: "1px solid var(--gray-a5)",
						borderRadius: 5,
						background: "var(--gray-a2)",
						color: "var(--gray-12)",
						fontFamily: "var(--ttml-font-mono)",
						fontSize: 11,
					}}
				/>
			</Flex>
		</label>
	);
}

function ThemeEditor({
	theme,
	scheme,
	onBack,
	onSaved,
}: {
	theme: ThemePack;
	scheme: ThemeScheme;
	onBack: () => void;
	onSaved: () => void;
}) {
	const catalog = useAtomValue(themeCatalogAtom);
	const [name, setName] = useState(`${theme.name} Custom`);
	const [tokens, setTokens] = useState<ThemeTokenValues>({ ...scheme.tokens });
	const [css, setCss] = useState(theme.css ?? "");
	const [saving, setSaving] = useState(false);
	const warnings = useMemo(() => getContrastWarnings(tokens), [tokens]);
	const draftScheme: ThemeScheme = {
		...scheme,
		id: scheme.id,
		tokens,
	};

	const setToken = (key: ThemeTokenKey, value: string) => {
		setTokens((current) => ({ ...current, [key]: value }));
	};

	const resetColors = () => {
		const fallback = BUILTIN_THEMES[0].schemes.find(
			(item) => item.appearance === scheme.appearance,
		);
		if (fallback) setTokens({ ...fallback.tokens });
	};

	const buildTheme = (): ThemePack => {
		const id = uniqueThemeId(name, catalog);
		const next: ThemePack = {
			...theme,
			id,
			name: name.trim() || "Custom Theme",
			author: "Rimurulover",
			version: "1.0.0",
			builtin: false,
			css,
			schemes: theme.schemes.map((item) =>
				item.id === scheme.id ? { ...item, tokens } : item,
			),
		};
		return next;
	};

	const save = async () => {
		const next = buildTheme();
		const parsed = parseTheme(themeToJson(next, true), {
			allowBuiltinId: false,
		});
		if (!parsed.ok || !parsed.theme) {
			toast.error(parsed.errors[0] ?? "The theme could not be saved.");
			return;
		}
		setSaving(true);
		try {
			await installUserTheme(next, css);
			toast.success(`Saved “${next.name}”.`);
			onSaved();
			onBack();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			setSaving(false);
		}
	};

	const exportDraft = () => {
		downloadJson(sanitizeThemeId(name), themeToJson(buildTheme(), true));
	};

	return (
		<Flex direction="column" gap="3">
			<Flex align="center" gap="3" wrap="wrap">
				<Button variant="soft" onClick={onBack}>
					Back to themes
				</Button>
				<Box flexGrow="1" style={{ minWidth: 180 }}>
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						aria-label="Theme name"
						style={{
							width: "100%",
							height: 32,
							padding: "0 9px",
							border: "1px solid var(--gray-a6)",
							borderRadius: 7,
							background: "var(--gray-a2)",
							color: "var(--gray-12)",
							fontWeight: 600,
						}}
					/>
				</Box>
				<Button variant="soft" onClick={resetColors}>
					<ArrowReset24Regular /> Reset colors
				</Button>
				<Button variant="soft" onClick={exportDraft}>
					<ArrowDownload24Regular /> Export
				</Button>
				<Button onClick={save} disabled={saving}>
					<Save24Regular /> Save as theme
				</Button>
			</Flex>

			<Grid columns={{ initial: "1", md: "2" }} gap="3">
				<Card>
					<Flex direction="column" gap="2">
						<Text weight="bold">Live preview</Text>
						<ThemePreview scheme={draftScheme} />
						<Text size="1" color="gray">
							This preview updates immediately. Saving creates a separate theme
							pack; the original stays untouched.
						</Text>
					</Flex>
				</Card>
				<Card>
					<Flex direction="column" gap="2">
						<Text weight="bold">Contrast check</Text>
						{warnings.length === 0 ? (
							<Text size="1" color="green">
								Main text pairs meet WCAG AA (4.5:1).
							</Text>
						) : (
							<Flex direction="column" gap="1">
								<Text size="1" color="amber">
									These pairs are below 4.5:1. You can still save, but they may be
									hard to read:
								</Text>
								{warnings.map((warning) => (
									<Text
										key={`${warning.foreground}-${warning.background}`}
										size="1"
										color="gray"
									>
										{THEME_TOKEN_LABELS[warning.foreground]} on{" "}
										{THEME_TOKEN_LABELS[warning.background]} —{" "}
										{warning.ratio.toFixed(2)}:1
									</Text>
								))}
							</Flex>
						)}
					</Flex>
				</Card>
			</Grid>

			<Card>
				<Flex direction="column" gap="3">
					<Text weight="bold">Colors</Text>
					{THEME_TOKEN_GROUPS.map((group) => (
						<Box key={group.title}>
							<Text size="1" weight="bold" color="gray">
								{group.title}
							</Text>
							<Grid
								columns={{ initial: "1", sm: "2", lg: "3" }}
								gap="2"
								style={{ marginTop: 6 }}
							>
								{group.keys.map((key) => (
									<TokenField
										key={key}
										label={THEME_TOKEN_LABELS[key]}
										value={tokens[key]}
										onChange={(value) => setToken(key, value)}
									/>
								))}
							</Grid>
						</Box>
					))}
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" gap="2">
						<Text weight="bold">Custom CSS</Text>
						<Badge size="1" color="gray">
							CSS only
						</Badge>
					</Flex>
					<textarea
						value={css}
						onChange={(event) => setCss(event.target.value)}
						rows={8}
						spellCheck={false}
						placeholder={'html[data-ui-layer="new"] .example { color: var(--ttml-accent); }'}
						style={{
							width: "100%",
							resize: "vertical",
							borderRadius: 8,
							border: "1px solid var(--gray-a5)",
							background: "var(--gray-a2)",
							color: "var(--gray-12)",
							padding: 10,
							fontFamily: "var(--ttml-font-mono)",
							fontSize: 12,
						}}
					/>
					<Text size="1" color="gray">
						Remote images and fonts stay blocked unless you enable them in the
						theme manager. Scripts, HTML, remote @import, and remote url() are
						removed.
					</Text>
				</Flex>
			</Card>
		</Flex>
	);
}

function CustomCssCard() {
	const [enabled, setEnabled] = useAtom(themeCustomCssEnabledAtom);
	const [css, setCss] = useAtom(themeCustomCssAtom);
	const [allowRemote, setAllowRemote] = useAtom(
		themeAllowRemoteContentAtom,
	);
	const preview = useMemo(
		() => sanitizeThemeCss(css, { allowRemote }),
		[allowRemote, css],
	);
	return (
		<Card id="appearance-theme-custom-css">
			<Flex direction="column" gap="3">
				<Flex align="start" justify="between" gap="3" wrap="wrap">
					<Box>
						<Text weight="bold" as="div">
							Custom theme CSS
						</Text>
						<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
							Small personal tweaks that apply on top of the active theme. The
							box is CSS only and never runs scripts.
						</Text>
					</Box>
					<Switch
						checked={enabled}
						onCheckedChange={setEnabled}
						aria-label="Enable custom theme CSS"
					/>
				</Flex>
				<textarea
					value={css}
					onChange={(event) => setCss(event.target.value)}
					rows={7}
					spellCheck={false}
					placeholder={'.sidebar { border-color: var(--ttml-accent); }'}
					style={{
						width: "100%",
						resize: "vertical",
						borderRadius: 8,
						border: "1px solid var(--gray-a5)",
						background: "var(--gray-a2)",
						color: "var(--gray-12)",
						padding: 10,
						fontFamily: "var(--ttml-font-mono)",
						fontSize: 12,
					}}
				/>
				<Flex align="center" justify="between" gap="3" wrap="wrap">
					<Flex align="center" gap="2">
						<Switch
							checked={allowRemote}
							onCheckedChange={setAllowRemote}
							aria-label="Allow remote theme images and fonts"
						/>
						<Text size="1" color="gray">
							Allow remote images and fonts (can reveal your IP address)
						</Text>
					</Flex>
					<Flex gap="2">
						<Button
							size="1"
							variant="soft"
							onClick={() => setCss("")}
							disabled={!css}
						>
							Reset CSS
						</Button>
						<Text size="1" color={preview.blockedRemoteUrls ? "amber" : "gray"}>
							{preview.blockedRemoteUrls
								? "Remote URLs are currently blocked."
								: `${css.length} characters`}
						</Text>
					</Flex>
				</Flex>
			</Flex>
		</Card>
	);
}

export function ThemeAdvancedCard() {
	return <CustomCssCard />;
}

export function ThemeSettingsCard() {
	const activeTheme = useAtomValue(activeThemeAtom);
	const scheme = useAtomValue(activeThemeSchemeAtom);
	const [managerOpen, setManagerOpen] = useState(false);
	const [schemeId] = useAtom(themeSchemeIdAtom);
	return (
		<>
			<Card id="appearance-themes">
				<Flex gap="3" align="start" justify="between" wrap="wrap">
					<Flex gap="3" align="start">
						<PaintBrush24Regular />
						<Box>
							<Flex align="center" gap="2" wrap="wrap">
								<Text weight="bold">Themes</Text>
								<Badge size="1" color="gray">
									New UI only
								</Badge>
							</Flex>
							<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
								{activeTheme.name} ·{" "}
								{schemeId === DEFAULT_SCHEME_ID ? "Follow app theme" : scheme.name}
							</Text>
							<Text size="1" color="gray" as="div">
								Installable color schemes and CSS. Classic keeps its existing
								colors.
							</Text>
						</Box>
					</Flex>
					<Button variant="soft" onClick={() => setManagerOpen(true)}>
						<Edit24Regular /> Manage themes
					</Button>
				</Flex>
			</Card>
			<ThemeManagerDialog
				open={managerOpen}
				onOpenChange={setManagerOpen}
			/>
		</>
	);
}

export function ThemeManagerDialog({
	open: dialogOpen,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const catalog = useAtomValue(themeCatalogAtom);
	const isDark = useAtomValue(isDarkThemeAtom);
	const effectsSuppressed = useAtomValue(effectsSuppressedAtom);
	const [themeId, setThemeId] = useAtom(themeIdAtom);
	const [schemeId, setSchemeId] = useAtom(themeSchemeIdAtom);
	const setUserThemes = useSetAtom(userThemesAtom);
	const setReloadToken = useSetAtom(themeReloadTokenAtom);
	const [reduceEffects, setReduceEffects] = useAtom(themeReduceEffectsAtom);
	const [allowRemote, setAllowRemote] = useAtom(themeAllowRemoteContentAtom);
	const [autoReload, setAutoReload] = useAtom(themeAutoReloadAtom);
	const [view, setView] = useState<"gallery" | "editor">("gallery");
	const [pending, setPending] = useState<{
		theme: ThemePack;
		css?: string;
		assets: ThemeAssetFile[];
	} | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const activeTheme = catalog.find((theme) => theme.id === themeId) ?? catalog[0];
	const activeScheme = resolveScheme(activeTheme, schemeId, isDark);
	const backdropSupported = supportsBackdrop();
	const effectsOff = effectsSuppressed || !backdropSupported;

	const refreshThemes = async () => {
		const themes = await loadUserThemes();
		setUserThemes(themes);
		setReloadToken((value) => value + 1);
	};

	useEffect(() => {
		const refresh = () => {
			void loadUserThemes().then((themes) => {
				setUserThemes(themes);
				setReloadToken((value) => value + 1);
			});
		};
		window.addEventListener("ttml:themes-changed", refresh);
		return () => window.removeEventListener("ttml:themes-changed", refresh);
	}, [setUserThemes, setReloadToken]);

	const applyTheme = (theme: ThemePack, nextScheme = DEFAULT_SCHEME_ID) => {
		setThemeId(theme.id);
		setSchemeId(nextScheme);
		toast.success(`Applied “${theme.name}”.`);
	};

	const duplicateTheme = async (theme: ThemePack) => {
		const id = uniqueThemeId(`${theme.id}-copy`, catalog);
		const copy: ThemePack = {
			...theme,
			id,
			name: `${theme.name} Copy`,
			author: "Rimurulover",
			builtin: false,
			sourcePath: undefined,
		};
		try {
			await installUserTheme(
				copy,
				theme.css,
			);
			await refreshThemes();
			setThemeId(id);
			setSchemeId(DEFAULT_SCHEME_ID);
			toast.success(`Created “${copy.name}”.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	const removeTheme = async (theme: ThemePack) => {
		if (theme.builtin) return;
		if (
			!window.confirm(
				`Delete “${theme.name}”? It will stay in the recycle bin for the retention period.`,
			)
		)
			return;
		try {
			const removed = buildThemeRecycleItem(theme);
			await addRecycleItems([removed]);
			await deleteUserTheme(theme.id);
			await refreshThemes();
			if (themeId === theme.id) {
				setThemeId(DEFAULT_THEME_ID);
				setSchemeId(DEFAULT_SCHEME_ID);
			}
			toast.success(`Deleted “${theme.name}”.`);
			showUndoToast("Theme deleted", async () => {
				const result = await restoreRecycleItem(removed);
				if (!result.ok) {
					toast.error(result.message);
					return;
				}
				await deleteRecycleItem(removed.id);
				await refreshThemes();
				toast.success(result.message);
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	const installPending = async () => {
		if (!pending) return;
		try {
			await installUserTheme(pending.theme, pending.css, pending.assets);
			await refreshThemes();
			setThemeId(pending.theme.id);
			setSchemeId(DEFAULT_SCHEME_ID);
			setPending(null);
			setView("gallery");
			toast.success(`Installed “${pending.theme.name}”.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	const importFiles = async (files: File[]) => {
		setImportError(null);
		try {
			const zip = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
			if (zip) {
				const JSZip = (await import("jszip")).default;
				const archive = await JSZip.loadAsync(await zip.arrayBuffer());
				const loaded: Array<{ path: string; data: Uint8Array }> = [];
				let total = 0;
				for (const entry of Object.values(archive.files)) {
					if (entry.dir) continue;
					if (loaded.length >= 400) {
						throw new Error("The theme zip has too many files.");
					}
					const data = await entry.async("uint8array");
					total += data.byteLength;
					if (total > 12 * 1024 * 1024) {
						throw new Error("The theme zip is larger than 12 MB.");
					}
					loaded.push({ path: entry.name, data });
				}
				const result = await readThemeBundle(loaded);
				if (!result.theme) {
					setImportError(result.errors.join(" "));
					return;
				}
				setPending({
					theme: result.theme,
					css: result.css,
					assets: result.assets,
				});
				return;
			}

			const jsonFile = files.find((file) =>
				file.name.toLowerCase().endsWith(".json"),
			);
			const cssFile = files.find((file) =>
				file.name.toLowerCase().endsWith(".css"),
			);
			if (!jsonFile) {
				if (cssFile) {
					const css = await cssFile.text();
					const base = BUILTIN_THEMES[0];
					const draft: ThemePack = {
						...base,
						id: uniqueThemeId(
							sanitizeThemeId(cssFile.name.replace(/\.css$/i, "")),
							catalog,
						),
						name: cssFile.name.replace(/\.css$/i, "") || "Imported CSS",
						author: "Imported",
						version: "1.0.0",
						description: "A CSS-only theme using the Default color schemes.",
						css,
						builtin: false,
						sourcePath: undefined,
					};
					setPending({ theme: draft, css, assets: [] });
					return;
				}
				setImportError("Choose a theme.json, a .css file, a .zip, or a folder.");
				return;
			}
			const text = await jsonFile.text();
			const css = cssFile ? await cssFile.text() : undefined;
			const result = await readThemeBundle([
				{
					path: "theme.json",
					data: new TextEncoder().encode(text),
				},
				...(css
					? [
							{
								path: "theme.css",
								data: new TextEncoder().encode(css),
							},
						]
					: []),
			]);
			if (!result.theme) {
				setImportError(result.errors.join(" "));
				return;
			}
			setPending({
				theme: result.theme,
				css: result.css,
				assets: result.assets,
			});
		} catch (error) {
			setImportError(error instanceof Error ? error.message : String(error));
		}
	};

	const importFolder = async () => {
		if (!isTauri()) {
			fileInput.current?.click();
			return;
		}
		try {
			const picked = await open({
				directory: true,
				multiple: false,
				recursive: true,
				title: "Choose a theme folder",
			});
			if (typeof picked !== "string") return;
			const result = await readThemeFolder(picked);
			if (!result.theme) {
				setImportError(result.errors.join(" "));
				return;
			}
			setPending({
				theme: result.theme,
				css: result.css,
				assets: result.assets,
			});
		} catch (error) {
			setImportError(error instanceof Error ? error.message : String(error));
		}
	};

	useEffect(() => {
		if (!dialogOpen) {
			setView("gallery");
			setPending(null);
			setImportError(null);
		}
	}, [dialogOpen]);

	if (!activeTheme) return null;

	return (
		<Dialog
			open={dialogOpen}
			onOpenChange={onOpenChange}
			title="Themes"
			description="Installable color schemes and CSS for the New interface. Themes never contain JavaScript."
			size="large"
			contentProps={{ style: { animation: "none" } }}
		>
			<Flex direction="column" gap="3" style={{ maxHeight: "72vh", overflow: "auto" }}>
				{pending ? (
					<Flex direction="column" gap="3">
						<Card>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2" wrap="wrap">
									<Text weight="bold">{pending.theme.name}</Text>
									<Badge size="1" color="gray">
										v{pending.theme.version}
									</Badge>
									<Badge
										size="1"
										color={
											pending.theme.effects?.level !== "none"
												? "amber"
												: "gray"
										}
									>
										{effectLabel(pending.theme)}
									</Badge>
								</Flex>
								<Text size="1" color="gray">
									by {pending.theme.author} · {pending.theme.description}
								</Text>
								<ThemePreview
									scheme={pending.theme.schemes[0]}
									compact
								/>
								{getContrastWarnings(pending.theme.schemes[0].tokens).length ? (
									<Text size="1" color="amber">
										<Warning24Regular /> Low contrast:{" "}
										{getContrastWarnings(pending.theme.schemes[0].tokens)
											.map(
												(warning) =>
													`${warning.foreground}/${warning.background}`,
											)
											.join(", ")}
									</Text>
								) : null}
								<Text size="1" color="gray">
									{pending.theme.schemes.length} color scheme
									{pending.theme.schemes.length === 1 ? "" : "s"} ·{" "}
									{pending.css ? `${pending.css.length} CSS characters` : "No theme.css"} ·{" "}
									{pending.assets.length} asset
									{pending.assets.length === 1 ? "" : "s"}
								</Text>
								{catalog.some((theme) => theme.id === pending.theme.id) ? (
									<Text size="1" color="amber">
										A theme with this id already exists. Installing will replace
										it.
									</Text>
								) : null}
							</Flex>
						</Card>
						<Flex gap="2" justify="end">
							<Button variant="soft" onClick={() => setPending(null)}>
								Cancel
							</Button>
							<Button onClick={installPending}>
								<Save24Regular /> Install & apply
							</Button>
						</Flex>
					</Flex>
				) : view === "editor" ? (
					<ThemeEditor
						theme={activeTheme}
						scheme={activeScheme}
						onBack={() => setView("gallery")}
						onSaved={() => {
							void refreshThemes();
						}}
					/>
				) : (
					<>
						<Flex align="center" gap="3" wrap="wrap" justify="between">
							<Badge size="2" color="gray">
								Current: {activeTheme.name}
							</Badge>
							<Flex gap="2" wrap="wrap">
								<Button variant="soft" onClick={() => fileInput.current?.click()}>
									<ArrowUpload24Regular /> Import file
								</Button>
								<Button variant="soft" onClick={importFolder}>
									<FolderOpen24Regular /> Import folder
								</Button>
								<Button
									variant="soft"
									onClick={() => {
										void refreshThemes().then(() =>
											toast.info("Themes reloaded from disk."),
										);
									}}
								>
									<ArrowReset24Regular /> Reload
								</Button>
								<Button variant="soft" onClick={() => setView("editor")}>
									<Edit24Regular /> Editor
								</Button>
							</Flex>
						</Flex>

						<input
							ref={fileInput}
							type="file"
							accept=".json,.css,.zip,application/json,text/css,application/zip"
							multiple
							hidden
							onChange={(event) => {
								const files = Array.from(event.target.files ?? []);
								event.target.value = "";
								if (files.length) void importFiles(files);
							}}
						/>

						<Card>
							<Flex gap="3" align="start" justify="between" wrap="wrap">
								<Box>
									<Text weight="bold" size="2">
										Theme performance and effects
									</Text>
									<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
										Glass effects are only used on toolbars, menus, dialogs, and
										the transport bar — never on Preview lyrics or Time word chips.
										Performance Mode and reduced-motion turn them into flat colors.
									</Text>
									{!backdropSupported ? (
										<Text size="1" color="amber" as="div" style={{ marginTop: 4 }}>
											<Warning24Regular /> Glass effects are not supported on this
											PC.
										</Text>
									) : effectsOff ? (
										<Text size="1" color="amber" as="div" style={{ marginTop: 4 }}>
											Effects are off on this PC or because Performance Mode is on.
										</Text>
									) : null}
								</Box>
								<Flex direction="column" gap="2">
									<Flex align="center" gap="2">
										<Switch
											checked={reduceEffects}
											onCheckedChange={setReduceEffects}
										/>
										<Text size="1">Reduce effects</Text>
									</Flex>
									<Flex align="center" gap="2">
										<Switch
											checked={autoReload}
											onCheckedChange={setAutoReload}
										/>
										<Text size="1">Auto-reload theme files</Text>
									</Flex>
									<Flex align="center" gap="2">
										<Switch
											checked={allowRemote}
											onCheckedChange={setAllowRemote}
										/>
										<Text size="1">Allow remote images/fonts</Text>
									</Flex>
								</Flex>
							</Flex>
						</Card>

						<CommunityThemesPanel
							onPreview={(theme, css) =>
								setPending({ theme, css, assets: [] })
							}
						/>

						{importError ? (
							<Card style={{ borderColor: "var(--red-8)" }}>
								<Flex gap="2" align="start">
									<Warning24Regular />
									<Text size="1" color="red">
										{importError}
									</Text>
								</Flex>
							</Card>
						) : null}

						<Grid
							columns={{ initial: "1", sm: "2" }}
							gap="3"
						>
							{catalog.map((theme) => {
								const selected = theme.id === activeTheme.id;
								const preview = resolveScheme(theme, schemeId, isDark);
								const heavy =
									(theme.effects?.level ?? "none") !== "none" &&
									effectsOff;
								return (
									<Card
										key={theme.id}
										style={{
											borderColor: selected ? "var(--accent-9)" : undefined,
										}}
									>
										<Flex direction="column" gap="2">
											<ThemePreview scheme={preview} />
											<Flex align="center" justify="between" gap="2" wrap="wrap">
												<Box style={{ minWidth: 0 }}>
													<Text weight="bold" as="div">
														{theme.name}
													</Text>
													<Text size="1" color="gray" as="div">
														by {theme.author} · v{theme.version}
													</Text>
												</Box>
												{selected ? (
													<Badge size="1" color="green" variant="solid">
														Active
													</Badge>
												) : null}
											</Flex>
											<Text size="1" color="gray" style={{ minHeight: 30 }}>
												{theme.description}
											</Text>
											<Flex gap="1" wrap="wrap">
												<Badge
													size="1"
													color={
														(theme.effects?.level ?? "none") === "none"
															? "gray"
															: "amber"
													}
												>
													{effectLabel(theme)}
												</Badge>
												<Badge size="1" color="gray">
													{performanceLabel(theme)}
												</Badge>
												{theme.builtin ? (
													<Badge size="1" color="gray">
														Built-in
													</Badge>
												) : (
													<Badge size="1" color="gray">
														Installed
													</Badge>
												)}
												{heavy ? (
													<Badge size="1" color="amber">
														Effects off on this PC
													</Badge>
												) : null}
											</Flex>
											<Flex gap="1" wrap="wrap">
												<Button
													size="1"
													onClick={() => applyTheme(theme)}
													disabled={selected && schemeId === DEFAULT_SCHEME_ID}
												>
													Apply
												</Button>
												<Button
													size="1"
													variant="soft"
													onClick={() => duplicateTheme(theme)}
												>
													Duplicate
												</Button>
												<Button
													size="1"
													variant="soft"
													onClick={() => downloadJson(theme.id, themeToJson(theme, true))}
												>
													<ArrowDownload24Regular /> Export
												</Button>
												{!theme.builtin ? (
													<Button
														size="1"
														variant="soft"
														color="red"
														onClick={() => removeTheme(theme)}
													>
														<Delete24Regular /> Delete
													</Button>
												) : null}
											</Flex>
											<Flex align="center" gap="2" style={{ marginTop: 2 }}>
												<Text size="1" color="gray">
													Scheme
												</Text>
												<select
													value={selected ? schemeId : DEFAULT_SCHEME_ID}
													onChange={(event) => {
														setThemeId(theme.id);
														setSchemeId(event.target.value);
													}}
													style={{
														flex: 1,
														height: 28,
														borderRadius: 6,
														border:
															"1px solid var(--ttml-border, var(--gray-a6))",
														background:
															"var(--ttml-surface-2, var(--gray-a2))",
														color: "var(--ttml-text, var(--gray-12))",
													}}
												>
													<option value={DEFAULT_SCHEME_ID}>Follow app theme</option>
													{theme.schemes.map((scheme) => (
														<option key={scheme.id} value={scheme.id}>
															{scheme.name} ({scheme.appearance})
														</option>
													))}
												</select>
											</Flex>
										</Flex>
									</Card>
								);
							})}
						</Grid>

						<Flex justify="between" align="center" gap="3" wrap="wrap">
							<Text size="1" color="gray">
								Themes are stored in the app data <code>themes</code> folder.
								Classic ignores all theme packs.
							</Text>
							<Flex gap="2">
								<Button
									size="1"
									variant="soft"
									onClick={() => {
										const text = themeToJson(activeTheme, true);
										void navigator.clipboard.writeText(text).then(
											() => toast.success("Theme copied as text."),
											() => toast.error("Could not copy the theme."),
										);
									}}
								>
									Copy as text
								</Button>
								<Button
									size="1"
									variant="soft"
									onClick={async () => {
										try {
											const text = await navigator.clipboard.readText();
											const result = parseTheme(text);
											if (!result.ok || !result.theme) {
												setImportError(result.errors.join(" "));
												return;
											}
											setPending({
												theme: result.theme,
												css: result.theme.css,
												assets: [],
											});
										} catch (error) {
											setImportError(
												error instanceof Error ? error.message : String(error),
											);
										}
									}}
								>
									Import from text
								</Button>
							</Flex>
						</Flex>
					</>
				)}
			</Flex>
		</Dialog>
	);
}

export { CustomCssCard };
