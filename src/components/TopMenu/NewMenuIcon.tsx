import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { UiLayer, uiLayerAtom } from "$/modules/settings/states";

/**
 * Decorative menu icon that only exists in the New interface.
 * Classic keeps its original text-and-shortcut-only menu rows.
 */
export const NewMenuIcon = ({ children }: { children: ReactNode }) => {
	const uiLayer = useAtomValue(uiLayerAtom);
	if (uiLayer !== UiLayer.New) return null;

	return (
		<span data-new-menu-icon aria-hidden="true">
			{children}
		</span>
	);
};
