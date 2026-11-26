import type { ReactNode } from "react";
import styles from "./settings-components.module.css";

export interface SettingRowProps {
	label: ReactNode;
	description?: ReactNode;
	badge?: ReactNode;
	control: ReactNode;
}

export function SettingRow({
	label,
	description,
	badge,
	control,
}: SettingRowProps) {
	return (
		<div className={styles.row}>
			<div className={styles.rowText}>
				<div className={styles.rowLabelRow}>
					<span className={styles.rowLabel}>{label}</span>
					{badge}
				</div>
				{description ? (
					<div className={styles.rowDescription}>{description}</div>
				) : null}
			</div>
			<div className={styles.rowControl}>{control}</div>
		</div>
	);
}
