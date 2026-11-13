import {
	Add16Regular,
	Checkmark16Regular,
	Copy16Regular,
	Dismiss16Regular,
	LockClosed16Regular,
	LockOpen16Regular,
	PersonArrowRight16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Checkbox,
	Flex,
	Select,
	Separator,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { collabClient } from "./client";
import {
	ASSIGNABLE_ROLES,
	roleDescription,
	roleLabel,
	type CollabRole,
} from "./permissions";
import {
	collabFollowAtom,
	collabInvitesAtom,
	collabMembersAtom,
	collabPolicyAtom,
	collabRoleAtom,
	collabSelfIdAtom,
	collabSessionAtom,
	collabWaitingAtom,
} from "./states";
import { AvatarDot, Drawer, Hint, PaneSection, RoleBadge, formatWhen } from "./ui";
import styles from "./collab-ui.module.css";

function inviteUrl(base: string, code: string): string {
	try {
		const url = new URL(base);
		url.searchParams.set("invite", code);
		return url.toString();
	} catch {
		return base;
	}
}

async function copyText(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	} catch {
		toast.error("Couldn't copy. Select the text and copy it manually.");
	}
}

export function MembersPanel({ onClose }: { onClose: () => void }) {
	const members = useAtomValue(collabMembersAtom);
	const waiting = useAtomValue(collabWaitingAtom);
	const invites = useAtomValue(collabInvitesAtom);
	const policy = useAtomValue(collabPolicyAtom);
	const role = useAtomValue(collabRoleAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const session = useAtomValue(collabSessionAtom);
	const follow = useAtomValue(collabFollowAtom);
	const setFollow = useSetAtom(collabFollowAtom);

	const isHost = role === "host";
	const [inviteRole, setInviteRole] = useState<CollabRole>("editor");
	const [label, setLabel] = useState("");
	const [password, setPassword] = useState("");
	const [expiry, setExpiry] = useState("week");
	const [maxUses, setMaxUses] = useState("0");
	const [requireApproval, setRequireApproval] = useState(false);

	const sorted = useMemo(
		() =>
			[...members].sort((a, b) => {
				const rank = (value: CollabRole) =>
					value === "host"
						? 0
						: value === "editor"
							? 1
							: value === "commenter"
								? 2
								: 3;
				return rank(a.role) - rank(b.role) || a.name.localeCompare(b.name);
			}),
		[members],
	);

	const createInvite = () => {
		const expiresInMs =
			expiry === "never"
				? null
				: expiry === "hour"
					? 60 * 60 * 1000
					: expiry === "day"
						? 24 * 60 * 60 * 1000
						: 7 * 24 * 60 * 60 * 1000;
		const uses = Math.max(0, Number.parseInt(maxUses, 10) || 0);
		const created = collabClient.createInvite({
			label: label.trim() || undefined,
			password: password.trim() || undefined,
			role: inviteRole,
			expiresInMs,
			maxUses: uses > 0 ? uses : null,
			requireApproval,
		});
		if (created) {
			toast.success("Invite created");
			setLabel("");
			setPassword("");
			setMaxUses("0");
			setRequireApproval(false);
		}
	};

	return (
		<Drawer
			title="Room people"
			subtitle={`${members.length} in the room${waiting.length ? ` · ${waiting.length} waiting` : ""}`}
			onClose={onClose}
			footer={
				<Button variant="soft" color="gray" onClick={onClose}>
					Done
				</Button>
			}
		>
			<PaneSection
				title="People"
				action={
					<Flex align="center" gap="1">
						<RoleBadge role={role} />
						{isHost ? <Badge size="1">You control the room</Badge> : null}
					</Flex>
				}
			>
				<div className={styles.list}>
					{sorted.map((member) => {
						const self = member.id === selfId;
						const following = follow?.memberId === member.id;
						return (
							<div key={member.id} className={styles.row}>
								<button
									type="button"
									className={styles.badgeButton}
									title={following ? "Stop following" : `Follow ${member.name}`}
									aria-label={
										following ? "Stop following" : `Follow ${member.name}`
									}
									onClick={() => {
										if (self) return;
										setFollow(
											following
												? null
												: {
														memberId: member.id,
														name: member.name,
														color: member.color,
														followPlayback: true,
													},
										);
									}}
								>
									<AvatarDot member={member} />
								</button>
								<Box style={{ minWidth: 0, flex: 1 }}>
									<Flex align="center" gap="1" wrap="wrap">
										<Text size="2" weight={self ? "bold" : "medium"}>
											{member.name}
											{self ? " (you)" : ""}
										</Text>
										{following ? (
											<Badge size="1" color="green">
												Following
											</Badge>
										) : null}
										{!member.online ? (
											<Badge size="1" color="gray">
												Offline
											</Badge>
										) : null}
									</Flex>
									<Text size="1" color="gray">
										{roleLabel(member.role)}
									</Text>
								</Box>
								{isHost && !self ? (
									<Flex align="center" gap="1">
										<Tooltip content={roleDescription(member.role)}>
											<Select.Root
												value={member.role}
												onValueChange={(value) => {
													if (value === "host") return;
													collabClient.setRole(member.id, value as CollabRole);
												}}
											>
												<Select.Trigger
													variant="soft"
													aria-label={`Role for ${member.name}`}
												/>
												<Select.Content>
													{ASSIGNABLE_ROLES.map((value) => (
														<Select.Item key={value} value={value}>
															{roleLabel(value)}
														</Select.Item>
													))}
												</Select.Content>
											</Select.Root>
										</Tooltip>
										<Tooltip content="Make host">
											<Button
												size="1"
												variant="ghost"
												color="gray"
												aria-label={`Make ${member.name} host`}
												onClick={() => {
													if (
														window.confirm(
															`Hand over host to ${member.name}? You will become an editor.`,
														)
													) {
														collabClient.transferHost(member.id);
													}
												}}
											>
												<PersonArrowRight16Regular />
											</Button>
										</Tooltip>
										<Tooltip content="Remove from room">
											<Button
												size="1"
												variant="ghost"
												color="gray"
												aria-label={`Remove ${member.name}`}
												onClick={() => {
													if (
														window.confirm(`Remove ${member.name} from the room?`)
													) {
														collabClient.kick(member.id);
													}
												}}
											>
												<Dismiss16Regular />
											</Button>
										</Tooltip>
										<Tooltip content="Remove and block this device from rejoining">
											<Button
												size="1"
												variant="ghost"
												color="red"
												onClick={() => {
													if (
														window.confirm(																`Ban ${member.name}? They won't be able to rejoin from this device.`,
														)
													) {
														collabClient.ban(member.id);
													}
												}}
											>
												Ban
											</Button>
										</Tooltip>
									</Flex>
								) : (
									<RoleBadge role={member.role} />
								)}
							</div>
						);
					})}
					{members.length === 0 ? <Hint>No one else has joined yet.</Hint> : null}
				</div>
			</PaneSection>

			{waiting.length > 0 ? (
				<PaneSection title={`Waiting for approval (${waiting.length})`}>
					<div className={styles.list}>
						{waiting.map((peer) => (
							<div key={peer.id} className={styles.row}>
								<AvatarDot member={peer} />
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Text size="2" weight="medium" as="div">
										{peer.name}
									</Text>
									<Text size="1" color="gray">
										Asked {formatWhen(peer.at)}
									</Text>
								</Box>
								<Button
									size="1"
									variant="soft"
									color="green"
									disabled={!isHost}
									onClick={() => collabClient.approve(peer.id)}
								>
									<Checkmark16Regular /> Let in
								</Button>
								<Button
									size="1"
									variant="soft"
									color="gray"
									disabled={!isHost}
									onClick={() => collabClient.deny(peer.id)}
								>
									Deny
								</Button>
							</div>
						))}
					</div>
				</PaneSection>
			) : null}

			<PaneSection title="Invite people">
				<Hint>
					Invite links are unguessable. Anyone who has one can join in TTML
					Editor or a browser while the room is open unless you add a password
					or approval. Everyone in the room can see the project, names, edits,
					comments, and chat; network peers can see IP addresses.
				</Hint>
				<div className={styles.composer}>
					<Flex gap="2" wrap="wrap">
						<Select.Root
							value={inviteRole}
							onValueChange={(value) => setInviteRole(value as CollabRole)}
						>
							<Select.Trigger aria-label="Invite role" />
							<Select.Content>
								{ASSIGNABLE_ROLES.map((value) => (
									<Select.Item key={value} value={value}>
										{roleLabel(value)}
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>
						<Select.Root value={expiry} onValueChange={setExpiry}>
							<Select.Trigger aria-label="Invite expiry" />
							<Select.Content>
								<Select.Item value="hour">Expires in 1 hour</Select.Item>
								<Select.Item value="day">Expires in 24 hours</Select.Item>
								<Select.Item value="week">Expires in 7 days</Select.Item>
								<Select.Item value="never">Never expires</Select.Item>
							</Select.Content>
						</Select.Root>
						<TextField.Root
							value={maxUses}
							onChange={(event) => setMaxUses(event.currentTarget.value)}
							placeholder="Max uses (0 = no limit)"
							style={{ width: 160 }}
							aria-label="Maximum uses"
						/>
					</Flex>
					<TextField.Root
						value={label}
						onChange={(event) => setLabel(event.currentTarget.value)}
						placeholder="Label (optional), e.g. Translator"
					/>
					<TextField.Root
						type="password"
						value={password}
						onChange={(event) => setPassword(event.currentTarget.value)}
						placeholder="Password (optional)"
					/>
					<Flex align="center" gap="2">
						<Checkbox
							checked={requireApproval}
							onCheckedChange={(value) => setRequireApproval(value === true)}
							id="invite-approval"
						/>
						<Text as="label" htmlFor="invite-approval" size="2">
							Approve each person before they join
						</Text>
					</Flex>
					<Button disabled={!isHost} onClick={createInvite}>
						<Add16Regular /> Create invite
					</Button>
					{!isHost ? <Hint>Only the host can create invites.</Hint> : null}
				</div>
			</PaneSection>

			{invites.length > 0 ? (
				<PaneSection title={`Active invites (${invites.length})`}>
					<div className={styles.list}>
						{invites.map((invite) => {
							const link = session?.url
								? inviteUrl(session.url, invite.code)
								: invite.code;
							return (
								<div key={invite.id} className={styles.row}>
									<Box style={{ flex: 1, minWidth: 0 }}>
										<Flex align="center" gap="1" wrap="wrap">
											<Text size="2" weight="medium">
												{invite.label || roleLabel(invite.role)}
											</Text>
											<Badge size="1" variant="soft">
												{roleLabel(invite.role)}
											</Badge>
											{invite.hasPassword ? (
												<Badge size="1" color="amber">
													Password
												</Badge>
											) : null}
											{invite.requireApproval ? (
												<Badge size="1" color="blue">
													Approval
												</Badge>
											) : null}
											{invite.revoked ? (
												<Badge size="1" color="red">
													Revoked
												</Badge>
											) : null}
										</Flex>
										<Text size="1" color="gray" as="div">
											{invite.uses}
											{invite.maxUses ? `/${invite.maxUses}` : ""} uses ·{" "}
											{invite.expiresAt
												? `expires ${formatWhen(invite.expiresAt)}`
												: "no expiry"}
										</Text>
										<Text size="1" className={styles.mono} as="div">
											{invite.code}
										</Text>
									</Box>
									<Tooltip content="Copy invite link">
										<Button
											size="1"
											variant="ghost"
											onClick={() => copyText(link, "Invite link")}
										>
											<Copy16Regular />
										</Button>
									</Tooltip>
									<Button
										size="1"
										variant="ghost"
										color="gray"
										disabled={!isHost || invite.revoked}
										onClick={() => {
											if (
												!window.confirm(
													"Replace this invite with a new random code? The old code stops working. The new invite keeps the role, expiry, and use limits; set a new password if you need one.",
												)
											)
												return;
											const created = collabClient.createInvite({
												label: invite.label,
												role: invite.role,
												expiresInMs: invite.expiresAt
													? Math.max(60_000, invite.expiresAt - Date.now())
													: null,
												maxUses: invite.maxUses,
												requireApproval: invite.requireApproval,
											});
											if (created) collabClient.revokeInvite(invite.id);
										}}
									>
										Regenerate
									</Button>
									<Button
										size="1"
										variant="ghost"
										color="red"
										disabled={!isHost || invite.revoked}
										onClick={() => {
											if (window.confirm("Revoke this invite?")) {
												collabClient.revokeInvite(invite.id);
											}
										}}
									>
										Revoke
									</Button>
								</div>
							);
						})}
					</div>
				</PaneSection>
			) : null}

			<PaneSection title="Room settings">
				<Flex align="center" justify="between" gap="2">
					<Box>
						<Text size="2" weight="medium" as="div">
							Default role for new people
						</Text>
						<Hint>
							Used when someone joins without an invite that names a role.
						</Hint>
					</Box>
					<Select.Root
						value={policy.defaultRole}
						disabled={!isHost}
						onValueChange={(value) =>
							collabClient.updatePolicy({ defaultRole: value as CollabRole })
						}
					>
						<Select.Trigger aria-label="Default join role" />
						<Select.Content>
							{ASSIGNABLE_ROLES.map((value) => (
								<Select.Item key={value} value={value}>
									{roleLabel(value)}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				</Flex>
				<Separator size="4" />
				<Flex align="center" justify="between" gap="3">
					<Box>
						<Text size="2" weight="medium" as="div">
							Approve people before they join
						</Text>
						<Hint>New joiners wait in a lobby until you let them in.</Hint>
					</Box>
					<Switch
						checked={policy.approveJoiners}
						disabled={!isHost}
						onCheckedChange={(value) =>
							collabClient.updatePolicy({ approveJoiners: value })
						}
					/>
				</Flex>
				<Flex align="center" justify="between" gap="3">
					<Box>
						<Text size="2" weight="medium" as="div">
							Editors can roll back changes
						</Text>
						<Hint>
							Off by default. Reverting can undo another person's work.
						</Hint>
					</Box>
					<Switch
						checked={policy.editorsCanRollback}
						disabled={!isHost}
						onCheckedChange={(value) =>
							collabClient.updatePolicy({ editorsCanRollback: value })
						}
					/>
				</Flex>
				<Flex align="center" justify="between" gap="3">
					<Box>
						<Text size="2" weight="medium" as="div">
							Lock the room
						</Text>
						<Hint>No new people can join until you unlock it.</Hint>
					</Box>
					<Button
						variant="soft"
						color={policy.locked ? "red" : "gray"}
						disabled={!isHost}
						onClick={() => collabClient.lockRoom(!policy.locked)}
					>
						{policy.locked ? <LockClosed16Regular /> : <LockOpen16Regular />}
						{policy.locked ? "Locked" : "Unlocked"}
					</Button>
				</Flex>
				{!isHost ? (
					<Hint>Only the host can change room settings.</Hint>
				) : null}
			</PaneSection>

			<PaneSection title="Sharing warning">
				<Hint>
					Live rooms are not end-to-end encrypted. The host and the tunnel
					provider can see room traffic. Anyone in the room can copy what they
					see. Do not share confidential lyrics or unreleased audio.
				</Hint>
			</PaneSection>
		</Drawer>
	);
}
