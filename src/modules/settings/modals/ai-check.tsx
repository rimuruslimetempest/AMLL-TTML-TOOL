import { Bot24Regular, Key24Regular, Server24Regular } from "@fluentui/react-icons";
import {
	Button,
	Card,
	Flex,
	Heading,
	RadioGroup,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import type { AiCheckProvider } from "$/modules/ai-check/ai-client";
import {
	aiCheckApiKeyAtom,
	aiCheckBaseUrlAtom,
	aiCheckModelAtom,
	aiCheckOllamaModelAtom,
	aiCheckOllamaUrlAtom,
	aiCheckPersistKeyAtom,
	aiCheckProviderAtom,
	clearStoredAiCheckApiKeyAtom,
} from "$/modules/ai-check/states";

export function SettingsAiCheckTab() {
	const { t } = useTranslation();
	const [provider, setProvider] = useAtom(aiCheckProviderAtom);
	const [baseUrl, setBaseUrl] = useAtom(aiCheckBaseUrlAtom);
	const [model, setModel] = useAtom(aiCheckModelAtom);
	const [apiKey, setApiKey] = useAtom(aiCheckApiKeyAtom);
	const [ollamaUrl, setOllamaUrl] = useAtom(aiCheckOllamaUrlAtom);
	const [ollamaModel, setOllamaModel] = useAtom(aiCheckOllamaModelAtom);
	const [persistKey, setPersistKey] = useAtom(aiCheckPersistKeyAtom);
	const [, clearStoredKey] = useAtom(clearStoredAiCheckApiKeyAtom);

	const setPersistence = (enabled: boolean) => {
		setPersistKey(enabled);
		if (enabled) setApiKey(apiKey);
		else clearStoredKey();
	};

	return (
		<Flex direction="column" gap="4">
			<Heading size="4">
				{t("settings.aiCheck.title", "AI Check")}
			</Heading>
			<Text size="2" color="gray">
				{t(
					"settings.aiCheck.description",
					"Local rule checks always run. The optional AI pass sends your TTML to the provider below for a deeper review.",
				)}
			</Text>

			<Card>
				<Flex gap="3" align="start">
					<Bot24Regular />
					<Flex direction="column" gap="2" style={{ flex: 1 }}>
						<Text weight="bold">
							{t("settings.aiCheck.provider", "Provider")}
						</Text>
						<RadioGroup.Root
							value={provider}
							onValueChange={(value) => setProvider(value as AiCheckProvider)}
						>
							<Flex direction="column" gap="2">
								<Text as="label" size="2">
									<Flex gap="2" align="center">
										<RadioGroup.Item value="openai" />
										{t(
											"settings.aiCheck.providerOpenAI",
											"OpenAI-compatible API",
										)}
									</Flex>
								</Text>
								<Text as="label" size="2">
									<Flex gap="2" align="center">
										<RadioGroup.Item value="ollama" />
										{t("settings.aiCheck.providerOllama", "Local Ollama")}
									</Flex>
								</Text>
							</Flex>
						</RadioGroup.Root>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="3">
					<Flex gap="3" align="center">
						<Server24Regular />
						<Flex direction="column" gap="1" style={{ flex: 1 }}>
							<Text>
								{provider === "ollama"
									? t("settings.aiCheck.ollamaEndpoint", "Ollama endpoint")
									: t("settings.aiCheck.endpoint", "API base URL")}
							</Text>
							<Text size="1" color="gray">
								{provider === "ollama"
									? t(
											"settings.aiCheck.ollamaEndpointDesc",
											"Default is http://localhost:11434. The model must already be pulled.",
										)
									: t(
											"settings.aiCheck.endpointDesc",
											"/chat/completions is appended to this URL.",
										)}
							</Text>
						</Flex>
					</Flex>
					{provider === "ollama" ? (
						<>
							<TextField.Root
								value={ollamaUrl}
								onChange={(event) => setOllamaUrl(event.target.value)}
								placeholder="http://localhost:11434"
							/>
							<TextField.Root
								value={ollamaModel}
								onChange={(event) => setOllamaModel(event.target.value)}
								placeholder="llama3.1"
							/>
						</>
					) : (
						<>
							<TextField.Root
								value={baseUrl}
								onChange={(event) => setBaseUrl(event.target.value)}
								placeholder="https://api.openai.com/v1"
							/>
							<TextField.Root
								value={model}
								onChange={(event) => setModel(event.target.value)}
								placeholder="gpt-4o-mini"
							/>
						</>
					)}
				</Flex>
			</Card>

			{provider === "openai" && (
				<Card>
					<Flex direction="column" gap="3">
						<Flex gap="3" align="center">
							<Key24Regular />
							<Flex direction="column" gap="1" style={{ flex: 1 }}>
								<Text>{t("settings.aiCheck.apiKey", "API key")}</Text>
								<Text size="1" color="gray">
									{t(
										"settings.aiCheck.apiKeyDesc",
										"Leave empty for endpoints that do not require a key. The key is only sent to the URL above.",
									)}
								</Text>
							</Flex>
						</Flex>
						<TextField.Root
							type="password"
							value={apiKey}
							onChange={(event) => setApiKey(event.target.value)}
							placeholder="sk-..."
						/>
						<Flex justify="between" align="center" gap="3">
							<Flex direction="column" gap="1">
								<Text>{t("settings.aiCheck.storeKey", "Store key on this device")}</Text>
								<Text size="1" color="red">
									{t(
										"settings.aiCheck.storeKeyWarning",
										"Stored in plain local storage. Leave off to keep the key in memory for this session only.",
									)}
								</Text>
							</Flex>
							<Switch checked={persistKey} onCheckedChange={setPersistence} />
						</Flex>
						<Button
							size="1"
							variant="soft"
							color="gray"
							onClick={clearStoredKey}
						>
							{t("settings.aiCheck.clearStoredKey", "Forget stored key")}
						</Button>
					</Flex>
				</Card>
			)}
		</Flex>
	);
}