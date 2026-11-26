import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { interfaceDirectionAtom } from "$/modules/studio/state";
import { setAnnounceSink } from "./announce";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "yi", "dv", "ps", "ku"]);

export function RtlAndAnnouncer() {
	const { i18n } = useTranslation();
	const direction = useAtomValue(interfaceDirectionAtom);
	const [message, setMessage] = useState("");
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		setAnnounceSink((next) => {
			setMessage("");
			window.setTimeout(() => setMessage(next), 20);
			if (timerRef.current) window.clearTimeout(timerRef.current);
			timerRef.current = window.setTimeout(() => setMessage(""), 7000);
		});
		return () => {
			setAnnounceSink(null);
			if (timerRef.current) window.clearTimeout(timerRef.current);
		};
	}, []);

	useEffect(() => {
		const apply = () => {
			const language = (i18n.resolvedLanguage || i18n.language || "en-US")
				.split("-")[0]
				.toLowerCase();
			const rtl =
				direction === "auto" ? RTL_LANGUAGES.has(language) : direction === "rtl";
			const root = document.documentElement;
			root.dir = rtl ? "rtl" : "ltr";
			root.dataset.rtl = rtl ? "true" : "false";
			root.lang = i18n.resolvedLanguage || i18n.language || "en-US";
		};
		apply();
		i18n.on("languageChanged", apply);
		return () => i18n.off("languageChanged", apply);
	}, [direction, i18n]);

	return (
		<div
			aria-live="polite"
			aria-atomic="true"
			role="status"
			style={{
				position: "absolute",
				inlineSize: 1,
				blockSize: 1,
				padding: 0,
				margin: -1,
				overflow: "hidden",
				clip: "rect(0, 0, 0, 0)",
				whiteSpace: "nowrap",
				border: 0,
			}}
		>
			{message}
		</div>
	);
}
