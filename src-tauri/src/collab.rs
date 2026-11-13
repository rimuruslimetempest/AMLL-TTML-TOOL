use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::net::{Ipv4Addr, UdpSocket};
use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::header::{
    CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE, HeaderName, HeaderValue,
};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use futures_util::stream::SplitSink;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State as TauriState};
use tokio::sync::{broadcast, oneshot};
use tokio_util::io::ReaderStream;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;
use uuid::Uuid;

use crate::downloader::{command, find_tool, spawn_contained, terminate};

const PEER_COLORS: &[&str] = &[
    "#60a5fa", "#34d399", "#c084fc", "#fbbf24", "#fb7185", "#22d3ee", "#a3e635",
    "#f97316",
];
const MAX_CHAT_MESSAGES: usize = 250;
const MAX_CHAT_LENGTH: usize = 2000;
const LOCK_TTL_MS: u64 = 15_000;
const MAX_LOCKS_PER_CLIENT: usize = 20;
const MAX_HISTORY: usize = 500;
const MAX_RESTORE_POINTS: usize = 20;
const MAX_COMMENTS: usize = 2000;
const MAX_INVITES: usize = 50;
const AUTO_RESTORE_INTERVAL_MS: u64 = 5 * 60 * 1000;
const MAX_REVIEW_NOTE: usize = 500;
const MAX_COMMENT_LENGTH: usize = 2000;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabLine {
    pub id: String,
    pub data: Value,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabInsert {
    pub id: String,
    pub after_id: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CollabSnapshot {
    pub lines: Vec<CollabLine>,
    pub order: Vec<String>,
    pub project: Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabSession {
    pub url: String,
    pub local_url: String,
    pub ws_url: String,
    pub room_id: String,
    pub port: u16,
    pub lan_ip: String,
    pub remote: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub author_id: String,
    pub author_name: String,
    pub text: String,
    pub at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub color: String,
    pub role: String,
    pub joined_at: u64,
    pub online: bool,
    /// Stable browser-side identity used for bans; never sent to other people.
    #[serde(skip)]
    pub key: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub line_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub word_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub author_id: String,
    pub author_name: String,
    pub author_color: String,
    pub text: String,
    pub at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<u64>,
    #[serde(default)]
    pub resolved: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<u64>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewMark {
    pub line_id: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub author_id: String,
    pub author_name: String,
    pub at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedSplit {
    pub id: String,
    pub word_key: String,
    pub display_word: String,
    pub boundaries: Vec<u32>,
    pub label: String,
    pub note: String,
    pub added_by_id: String,
    pub added_by_name: String,
    pub created_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub at: u64,
    pub author_id: String,
    pub author_name: String,
    pub kind: String,
    pub summary: String,
    pub line_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub before: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revert_of: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePoint {
    pub id: String,
    pub name: String,
    pub at: u64,
    pub author_name: String,
    pub line_count: usize,
    pub automatic: bool,
}

#[derive(Clone)]
struct RestoreEntry {
    meta: RestorePoint,
    snapshot: CollabSnapshot,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    pub id: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub role: String,
    pub expires_at: Option<u64>,
    pub max_uses: Option<u32>,
    pub uses: u32,
    pub created_at: u64,
    pub revoked: bool,
    pub has_password: bool,
    pub require_approval: bool,
}

#[derive(Clone)]
struct InviteEntry {
    meta: Invite,
    password_hash: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaitingPeer {
    pub id: String,
    pub name: String,
    pub color: String,
    pub at: u64,
}

struct WaitingEntry {
    meta: WaitingPeer,
    role: String,
    invite_id: Option<String>,
    key: String,
    sender: tokio::sync::mpsc::UnboundedSender<ServerMessage>,
}

#[derive(Clone)]
struct BanEntry {
    key: String,
    name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomPolicy {
    pub default_role: String,
    pub editors_can_rollback: bool,
    pub locked: bool,
    pub approve_joiners: bool,
}

impl Default for RoomPolicy {
    fn default() -> Self {
        Self {
            default_role: "editor".to_string(),
            editors_can_rollback: false,
            locked: false,
            approve_joiners: false,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineLock {
    pub line_id: String,
    pub client_id: String,
    pub name: String,
    pub color: String,
    pub expires_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedMedia {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub added_by: String,
    pub at: u64,
}

#[derive(Clone)]
struct MediaEntry {
    meta: SharedMedia,
    path: PathBuf,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
enum ClientMessage {
    Patch {
        #[serde(default)]
        op_id: Option<String>,
        #[serde(default)]
        seq: Option<u64>,
        #[serde(default)]
        lines: Vec<CollabLine>,
        #[serde(default)]
        removed: Vec<String>,
        #[serde(default)]
        order: Option<Vec<String>>,
        #[serde(default)]
        inserts: Vec<CollabInsert>,
        #[serde(default)]
        project: Option<Value>,
        #[serde(default)]
        history_kind: Option<String>,
        #[serde(default)]
        history_summary: Option<String>,
        #[serde(default)]
        revert_of: Option<String>,
    },
    Chat {
        text: String,
    },
    Rename {
        name: String,
    },
    Lock {
        line_ids: Vec<String>,
    },
    Ping {
        at: u64,
    },
    SetRole {
        client_id: String,
        role: String,
    },
    TransferHost {
        client_id: String,
    },
    InviteCreate {
        #[serde(default)]
        label: Option<String>,
        #[serde(default)]
        password: Option<String>,
        role: String,
        #[serde(default)]
        expires_in_ms: Option<u64>,
        #[serde(default)]
        max_uses: Option<u32>,
        #[serde(default)]
        require_approval: Option<bool>,
    },
    InviteRevoke {
        invite_id: String,
    },
    Kick {
        client_id: String,
    },
    Ban {
        client_id: String,
    },
    LockRoom {
        locked: bool,
    },
    Approve {
        client_id: String,
    },
    Deny {
        client_id: String,
    },
    SetPolicy {
        #[serde(default)]
        default_role: Option<String>,
        #[serde(default)]
        editors_can_rollback: Option<bool>,
        #[serde(default)]
        approve_joiners: Option<bool>,
    },
    Comment {
        action: String,
        #[serde(default)]
        comment_id: Option<String>,
        #[serde(default)]
        line_id: Option<String>,
        #[serde(default)]
        word_id: Option<String>,
        #[serde(default)]
        parent_id: Option<String>,
        #[serde(default)]
        text: Option<String>,
        #[serde(default)]
        resolved: Option<bool>,
    },
    ReviewMark {
        line_id: String,
        status: String,
        #[serde(default)]
        note: Option<String>,
    },
    ShareSplit {
        id: String,
        word_key: String,
        display_word: String,
        boundaries: Vec<u32>,
        #[serde(default)]
        label: String,
        #[serde(default)]
        note: String,
    },
    RemoveSharedSplit {
        id: String,
    },
    Focus {
        line_id: String,
        #[serde(default)]
        word_id: Option<String>,
    },
    RestorePoint {
        name: String,
    },
    Restore {
        restore_point_id: String,
    },
    Revert {
        history_id: String,
    },
}

#[derive(Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum ServerMessage {
    Welcome {
        client_id: String,
        room_id: String,
        snapshot: CollabSnapshot,
        chat: Vec<ChatMessage>,
        peers: Vec<Peer>,
        media: Vec<SharedMedia>,
        locks: Vec<LineLock>,
        role: String,
        members: Vec<Peer>,
        comments: Vec<Comment>,
        review_marks: Vec<ReviewMark>,
        history: Vec<HistoryEntry>,
        restore_points: Vec<RestorePoint>,
        invites: Vec<Invite>,
        policy: RoomPolicy,
        waiting: Vec<WaitingPeer>,
        split_dictionary: Vec<SharedSplit>,
    },
    Patch {
        from: String,
        op_id: Option<String>,
        seq: Option<u64>,
        lines: Vec<CollabLine>,
        removed: Vec<String>,
        order: Option<Vec<String>>,
        inserts: Vec<CollabInsert>,
        project: Option<Value>,
    },
    Pong {
        at: u64,
    },
    Chat {
        message: ChatMessage,
    },
    Peers {
        peers: Vec<Peer>,
    },
    Locks {
        locks: Vec<LineLock>,
    },
    Media {
        media: Vec<SharedMedia>,
    },
    Members {
        members: Vec<Peer>,
        waiting: Vec<WaitingPeer>,
    },
    Comments {
        comments: Vec<Comment>,
    },
    Review {
        marks: Vec<ReviewMark>,
    },
    SplitDictionary {
        splits: Vec<SharedSplit>,
    },
    History {
        history: Vec<HistoryEntry>,
        restore_points: Vec<RestorePoint>,
    },
    Invites {
        invites: Vec<Invite>,
    },
    Policy {
        policy: RoomPolicy,
    },
    Focus {
        from: String,
        name: String,
        color: String,
        line_id: String,
        word_id: Option<String>,
        at: u64,
    },
    Snapshot {
        snapshot: CollabSnapshot,
    },
    Approved {
        client_id: String,
        snapshot: CollabSnapshot,
        role: String,
        members: Vec<Peer>,
        comments: Vec<Comment>,
        review_marks: Vec<ReviewMark>,
        history: Vec<HistoryEntry>,
        restore_points: Vec<RestorePoint>,
        policy: RoomPolicy,
        waiting: Vec<WaitingPeer>,
        split_dictionary: Vec<SharedSplit>,
    },
    Waiting {
        room_id: String,
    },
    Kicked {
        client_id: String,
        reason: String,
    },
    Permission {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Default)]
struct RoomData {
    snapshot: CollabSnapshot,
    chat: Vec<ChatMessage>,
    peers: Vec<Peer>,
    locks: Vec<LockEntry>,
    media: Vec<MediaEntry>,
    comments: Vec<Comment>,
    review_marks: Vec<ReviewMark>,
    split_dictionary: Vec<SharedSplit>,
    history: Vec<HistoryEntry>,
    restore_points: Vec<RestoreEntry>,
    invites: Vec<InviteEntry>,
    bans: Vec<BanEntry>,
    policy: RoomPolicy,
    last_restore_at: u64,
}

#[derive(Clone)]
struct LockEntry {
    line_id: String,
    client_id: String,
    expires_at: u64,
}

struct Room {
    id: String,
    data: Arc<Mutex<RoomData>>,
    tx: broadcast::Sender<ServerMessage>,
    waiting: Mutex<Vec<WaitingEntry>>,
    host_token: String,
}

struct RunningServer {
    shutdown: Option<oneshot::Sender<()>>,
    task: tauri::async_runtime::JoinHandle<()>,
    tunnel: Option<Child>,
    room: Arc<Room>,
}

impl Drop for RunningServer {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
        self.task.abort();
        if let Some(mut tunnel) = self.tunnel.take() {
            terminate(&mut tunnel);
        }
    }
}

#[derive(Default)]
pub struct CollabServerState {
    running: Mutex<Option<RunningServer>>,
}

#[derive(Deserialize)]
struct JoinQuery {
    room: Option<String>,
    name: Option<String>,
    #[serde(default)]
    key: Option<String>,
    #[serde(default)]
    invite: Option<String>,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    token: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn is_room_role(role: &str) -> bool {
    matches!(role, "host" | "editor" | "commenter" | "viewer")
}

fn can_edit(role: &str) -> bool {
    matches!(role, "host" | "editor")
}

fn can_comment(role: &str) -> bool {
    matches!(role, "host" | "editor" | "commenter")
}

fn role_of(data: &RoomData, client_id: &str) -> Option<String> {
    data.peers
        .iter()
        .find(|peer| peer.id == client_id)
        .map(|peer| peer.role.clone())
}

fn peer_of(data: &RoomData, client_id: &str) -> Option<Peer> {
    data.peers.iter().find(|peer| peer.id == client_id).cloned()
}

fn actor_name(data: &RoomData, client_id: &str) -> String {
    data.peers
        .iter()
        .find(|peer| peer.id == client_id)
        .map(|peer| peer.name.clone())
        .unwrap_or_else(|| "Host".to_string())
}

fn waiting_snapshot(room: &Room) -> Vec<WaitingPeer> {
    room.waiting
        .lock()
        .map(|waiting| waiting.iter().map(|entry| entry.meta.clone()).collect())
        .unwrap_or_default()
}

fn broadcast_members(room: &Room) {
    let members = room
        .data
        .lock()
        .map(|data| data.peers.clone())
        .unwrap_or_default();
    let waiting = waiting_snapshot(room);
    let _ = room.tx.send(ServerMessage::Peers {
        peers: members.clone(),
    });
    let _ = room.tx.send(ServerMessage::Members { members, waiting });
}

fn broadcast_history(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::History {
            history: data.history.clone(),
            restore_points: data
                .restore_points
                .iter()
                .map(|entry| entry.meta.clone())
                .collect(),
        });
    }
}

fn broadcast_comments(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::Comments {
            comments: data.comments.clone(),
        });
    }
}

fn broadcast_review(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::Review {
            marks: data.review_marks.clone(),
        });
    }
}

fn broadcast_invites(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::Invites {
            invites: data.invites.iter().map(|entry| entry.meta.clone()).collect(),
        });
    }
}

fn broadcast_policy(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::Policy {
            policy: data.policy.clone(),
        });
    }
}

/// Compact before/after bundle. Only changed lines are stored, not the song.
fn line_bundle(lines: &[CollabLine], order: Option<&[String]>) -> Value {
    json!({ "lines": lines, "order": order })
}

fn push_history(data: &mut RoomData, entry: HistoryEntry) {
    data.history.push(entry);
    if data.history.len() > MAX_HISTORY {
        let excess = data.history.len() - MAX_HISTORY;
        data.history.drain(0..excess);
    }
}

fn maybe_auto_restore_point(data: &mut RoomData, now: u64) {
    if now.saturating_sub(data.last_restore_at) < AUTO_RESTORE_INTERVAL_MS {
        return;
    }
    data.last_restore_at = now;
    let meta = RestorePoint {
        id: Uuid::new_v4().simple().to_string(),
        name: "Automatic restore point".to_string(),
        at: now,
        author_name: "Automatic".to_string(),
        line_count: data.snapshot.lines.len(),
        automatic: true,
    };
    data.restore_points.push(RestoreEntry {
        meta,
        snapshot: data.snapshot.clone(),
    });
    prune_restore_points(data);
}

fn prune_restore_points(data: &mut RoomData) {
    if data.restore_points.len() <= MAX_RESTORE_POINTS {
        return;
    }
    // Keep named points first, then the freshest automatic ones.
    let mut named = Vec::new();
    let mut automatic = Vec::new();
    for entry in data.restore_points.drain(..) {
        if entry.meta.automatic {
            automatic.push(entry);
        } else {
            named.push(entry);
        }
    }
    let keep_automatic = MAX_RESTORE_POINTS.saturating_sub(named.len());
    if automatic.len() > keep_automatic {
        automatic.drain(0..automatic.len() - keep_automatic);
    }
    data.restore_points = named;
    data.restore_points.extend(automatic);
}

fn invite_code() -> String {
    Uuid::new_v4().simple().to_string()[..16].to_string()
}

fn hash_invite_password(code: &str, password: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    code.hash(&mut hasher);
    password.hash(&mut hasher);
    hasher.finish()
}

fn insert_peer(
    data: &mut RoomData,
    client_id: &str,
    name: &str,
    key: &str,
    role: &str,
) -> Peer {
    let color = PEER_COLORS[data.peers.len() % PEER_COLORS.len()].to_string();
    let peer = Peer {
        id: client_id.to_string(),
        name: sanitize_name(name),
        color,
        role: role.to_string(),
        joined_at: now_ms(),
        online: true,
        key: key.to_string(),
    };
    data.peers.push(peer.clone());
    peer
}

fn use_invite(data: &mut RoomData, invite_id: Option<&String>) {
    let Some(invite_id) = invite_id else {
        return;
    };
    if let Some(invite) = data
        .invites
        .iter_mut()
        .find(|invite| invite.meta.id == *invite_id)
    {
        invite.meta.uses = invite.meta.uses.saturating_add(1);
    }
}

fn broadcast_split_dictionary(room: &Room) {
    if let Ok(data) = room.data.lock() {
        let _ = room.tx.send(ServerMessage::SplitDictionary {
            splits: data.split_dictionary.clone(),
        });
    }
}

fn build_welcome(room: &Room, client_id: &str, role: &str) -> Option<ServerMessage> {
    let waiting = waiting_snapshot(room);
    let data = room.data.lock().ok()?;
    let now = now_ms();
    let locks = lock_snapshot(&data, now);
    Some(ServerMessage::Welcome {
        client_id: client_id.to_string(),
        room_id: room.id.clone(),
        snapshot: data.snapshot.clone(),
        chat: data.chat.clone(),
        peers: data.peers.clone(),
        media: data.media.iter().map(|entry| entry.meta.clone()).collect(),
        locks,
        role: role.to_string(),
        members: data.peers.clone(),
        comments: data.comments.clone(),
        review_marks: data.review_marks.clone(),
        history: data.history.clone(),
        restore_points: data
            .restore_points
            .iter()
            .map(|entry| entry.meta.clone())
            .collect(),
        invites: data.invites.iter().map(|entry| entry.meta.clone()).collect(),
        policy: data.policy.clone(),
        waiting,
        split_dictionary: data.split_dictionary.clone(),
    })
}

fn validate_join(
    data: &RoomData,
    query: &JoinQuery,
) -> Result<(String, bool, Option<String>), String> {
    if data.policy.locked {
        return Err("The host locked this room. No new people can join.".to_string());
    }
    if let Some(code) = query.invite.as_deref() {
        let entry = data
            .invites
            .iter()
            .find(|entry| entry.meta.code == code)
            .ok_or_else(|| "That invite is not valid.".to_string())?;
        if entry.meta.revoked {
            return Err("That invite was revoked.".to_string());
        }
        let now = now_ms();
        if let Some(expires_at) = entry.meta.expires_at {
            if expires_at <= now {
                return Err("That invite has expired.".to_string());
            }
        }
        if let Some(max_uses) = entry.meta.max_uses {
            if entry.meta.uses >= max_uses {
                return Err("That invite has reached its limit.".to_string());
            }
        }
        if let Some(expected) = entry.password_hash {
            let provided = query.password.as_deref().unwrap_or_default();
            if hash_invite_password(code, provided) != expected {
                return Err("That invite password is incorrect.".to_string());
            }
        }
        return Ok((
            entry.meta.role.clone(),
            entry.meta.require_approval || data.policy.approve_joiners,
            Some(entry.meta.id.clone()),
        ));
    }
    Ok((
        data.policy.default_role.clone(),
        data.policy.approve_joiners,
        None,
    ))
}

fn sanitize_name(name: &str) -> String {
    let cleaned: String = name
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(32)
        .collect();
    if cleaned.is_empty() {
        "Guest".to_string()
    } else {
        cleaned
    }
}

fn local_ip() -> String {
    if let Ok(socket) = UdpSocket::bind(("0.0.0.0", 0)) {
        if socket.connect(("8.8.8.8", 80)).is_ok() {
            if let Ok(address) = socket.local_addr() {
                if !address.ip().is_loopback() {
                    return address.ip().to_string();
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

fn cloudflared_args(port: u16) -> Vec<String> {
    vec![
        "tunnel".to_string(),
        "--no-autoupdate".to_string(),
        "--protocol".to_string(),
        "http2".to_string(),
        "--url".to_string(),
        format!("http://127.0.0.1:{port}"),
    ]
}

fn find_tunnel_url(line: &str) -> Option<String> {
    const PREFIX: &str = "https://";
    for (index, _) in line.match_indices(PREFIX) {
        let rest = &line[index + PREFIX.len()..];
        let host: String = rest
            .chars()
            .take_while(|character| {
                character.is_ascii_alphanumeric() || *character == '.' || *character == '-'
            })
            .collect();
        if host.split('.').count() >= 3
            && host.ends_with(".trycloudflare.com")
            && host != "api.trycloudflare.com"
        {
            return Some(format!("https://{host}"));
        }
    }
    None
}

async fn start_cloudflared(app: &AppHandle, port: u16) -> Result<(Child, String), String> {
    let binary = find_tool(app, "cloudflared").ok_or_else(|| {
        "Cloudflare Tunnel is unavailable because cloudflared was not found. Turn it off to use local network sharing.".to_string()
    })?;
    let mut child = spawn_contained(
        command(binary)
            .args(cloudflared_args(port))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped()),
    )
    .map_err(|error| format!("Could not start Cloudflare Tunnel: {error}"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Cloudflare Tunnel did not expose its log stream.".to_string())?;

    let (tx, rx) = mpsc::sync_channel(32);
    std::thread::spawn(move || {
        let mut url = None;
        let mut registered = false;
        let mut sent = false;
        let mut diagnostics = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            log::debug!("cloudflared: {line}");
            if url.is_none() {
                url = find_tunnel_url(&line);
            }
            if line.contains("Registered tunnel connection") {
                registered = true;
            }
            if !sent {
                if let (Some(url), true) = (&url, registered) {
                    if tx.send(Ok(url.clone())).is_ok() {
                        sent = true;
                    } else {
                        break;
                    }
                }
            }
            if !sent {
                diagnostics.push_str(&line);
                diagnostics.push('\n');
                if diagnostics.len() > 8000 {
                    let mut boundary = diagnostics.len() - 4000;
                    while !diagnostics.is_char_boundary(boundary) {
                        boundary += 1;
                    }
                    diagnostics.drain(..boundary);
                }
            }
        }
        if !sent {
            let detail = if diagnostics.trim().is_empty() {
                "cloudflared exited before it was ready.".to_string()
            } else {
                diagnostics
            };
            let _ = tx.send(Err(detail));
        }
    });

    let result = tauri::async_runtime::spawn_blocking(move || {
        match rx.recv_timeout(Duration::from_secs(35)) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => {
                Err("Cloudflare Tunnel did not become ready within 35 seconds.".to_string())
            }
            Err(RecvTimeoutError::Disconnected) => {
                Err("Cloudflare Tunnel stopped before it was ready.".to_string())
            }
        }
    })
    .await
    .map_err(|error| format!("Cloudflare Tunnel task failed: {error}"))?;

    match result {
        Ok(url) => Ok((child, url)),
        Err(error) => {
            terminate(&mut child);
            Err(format!("Cloudflare Tunnel failed: {error}"))
        }
    }
}

fn resolve_web_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app.path().resource_dir().ok();
    let mut candidates = Vec::new();
    if let Some(resource_dir) = resource_dir {
        candidates.push(resource_dir.join("web"));
        candidates.push(resource_dir.join("resources/web"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/web"));
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist-collab"));
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist"));

    for candidate in candidates {
        if candidate.join("index.html").is_file() {
            return Ok(candidate);
        }
    }

    Err("Collaboration web files were not found. Build the frontend first, or use the installed app.".to_string())
}

fn peer_name(room: &Room, client_id: &str) -> String {
    room.data
        .lock()
        .ok()
        .and_then(|data| {
            data.peers
                .iter()
                .find(|peer| peer.id == client_id)
                .map(|peer| peer.name.clone())
        })
        .unwrap_or_else(|| "Guest".to_string())
}

fn lock_snapshot(data: &RoomData, now: u64) -> Vec<LineLock> {
    data.locks
        .iter()
        .filter(|lock| lock.expires_at > now)
        .filter_map(|lock| {
            let peer = data.peers.iter().find(|peer| peer.id == lock.client_id)?;
            Some(LineLock {
                line_id: lock.line_id.clone(),
                client_id: lock.client_id.clone(),
                name: peer.name.clone(),
                color: peer.color.clone(),
                expires_at: lock.expires_at,
            })
        })
        .collect()
}

fn prune_locks(data: &mut RoomData, now: u64) -> bool {
    let previous = data.locks.len();
    data.locks.retain(|lock| lock.expires_at > now);
    previous != data.locks.len()
}

fn prune_expired_locks(room: &Room) {
    let locks = match room.data.lock() {
        Ok(mut data) => {
            let now = now_ms();
            if !prune_locks(&mut data, now) {
                return;
            }
            lock_snapshot(&data, now)
        }
        Err(_) => return,
    };
    let _ = room.tx.send(ServerMessage::Locks { locks });
}

fn remove_peer(room: &Room, client_id: &str) {
    let (peers, locks) = match room.data.lock() {
        Ok(mut data) => {
            let now = now_ms();
            let was_host = data
                .peers
                .iter()
                .any(|peer| peer.id == client_id && peer.role == "host");
            data.peers.retain(|peer| peer.id != client_id);
            data.locks.retain(|lock| lock.client_id != client_id);
            if was_host {
                // The room should not become unmanageable when the host leaves.
                let promoted = data
                    .peers
                    .iter_mut()
                    .find(|peer| matches!(peer.role.as_str(), "editor" | "commenter"))
                    .map(|peer| {
                        peer.role = "host".to_string();
                        peer.name.clone()
                    });
                if let Some(name) = promoted {
                    push_history(
                        &mut data,
                        HistoryEntry {
                            id: Uuid::new_v4().simple().to_string(),
                            at: now,
                            author_id: "system".to_string(),
                            author_name: "Room".to_string(),
                            kind: "role".to_string(),
                            summary: format!("{name} became host after the previous host left"),
                            line_ids: Vec::new(),
                            before: None,
                            after: None,
                            revert_of: None,
                        },
                    );
                }
            }
            prune_locks(&mut data, now);
            (data.peers.clone(), lock_snapshot(&data, now))
        }
        Err(_) => return,
    };
    if let Ok(mut waiting) = room.waiting.lock() {
        waiting.retain(|entry| entry.meta.id != client_id);
    }
    let _ = room.tx.send(ServerMessage::Peers { peers });
    let _ = room.tx.send(ServerMessage::Locks { locks });
    broadcast_members(room);
}

fn rename_peer(room: &Room, client_id: &str, name: &str) {
    let (peers, locks) = match room.data.lock() {
        Ok(mut data) => {
            if let Some(peer) = data.peers.iter_mut().find(|peer| peer.id == client_id) {
                peer.name = sanitize_name(name);
            }
            let now = now_ms();
            prune_locks(&mut data, now);
            (data.peers.clone(), lock_snapshot(&data, now))
        }
        Err(_) => return,
    };
    let _ = room.tx.send(ServerMessage::Peers { peers });
    let _ = room.tx.send(ServerMessage::Locks { locks });
    broadcast_members(room);
}

fn set_peer_locks(room: &Room, client_id: &str, line_ids: &[String]) {
    let now = now_ms();
    let locks = match room.data.lock() {
        Ok(mut data) => {
            prune_locks(&mut data, now);
            data.locks.retain(|lock| lock.client_id != client_id);
            let known: HashSet<String> = data
                .snapshot
                .lines
                .iter()
                .map(|line| line.id.clone())
                .collect();
            let mut seen = HashSet::new();
            for line_id in line_ids.iter().take(MAX_LOCKS_PER_CLIENT) {
                if known.contains(line_id) && seen.insert(line_id.clone()) {
                    data.locks.push(LockEntry {
                        line_id: line_id.clone(),
                        client_id: client_id.to_string(),
                        expires_at: now + LOCK_TTL_MS,
                    });
                }
            }
            lock_snapshot(&data, now)
        }
        Err(_) => return,
    };
    let _ = room.tx.send(ServerMessage::Locks { locks });
}

fn apply_patch(
    data: &mut RoomData,
    lines: &[CollabLine],
    removed: &[String],
    order: Option<&[String]>,
    inserts: &[CollabInsert],
    project: Option<&Value>,
) {
    for removed_id in removed {
        data.snapshot.lines.retain(|line| line.id != *removed_id);
        data.snapshot.order.retain(|line_id| line_id != removed_id);
    }

    for line in lines {
        if line.id.is_empty() {
            continue;
        }
        if let Some(existing) = data
            .snapshot
            .lines
            .iter_mut()
            .find(|existing| existing.id == line.id)
        {
            *existing = line.clone();
        } else {
            data.snapshot.lines.push(line.clone());
        }
    }

    let known: HashSet<String> = data
        .snapshot
        .lines
        .iter()
        .map(|line| line.id.clone())
        .collect();

    if let Some(order) = order {
        let mut seen = HashSet::new();
        let mut next_order = Vec::with_capacity(known.len());
        for line_id in order {
            if known.contains(line_id) && seen.insert(line_id.clone()) {
                next_order.push(line_id.clone());
            }
        }
        for line in &data.snapshot.lines {
            if seen.insert(line.id.clone()) {
                next_order.push(line.id.clone());
            }
        }
        data.snapshot.order = next_order;
    } else {
        data.snapshot.order.retain(|line_id| known.contains(line_id));
        let mut seen: HashSet<String> = data.snapshot.order.iter().cloned().collect();
        for line in lines {
            if seen.insert(line.id.clone()) {
                data.snapshot.order.push(line.id.clone());
            }
        }
    }

    for insert in inserts {
        if !known.contains(&insert.id) {
            continue;
        }
        data.snapshot.order.retain(|line_id| line_id != &insert.id);
        let position = insert
            .after_id
            .as_ref()
            .and_then(|after| data.snapshot.order.iter().position(|id| id == after))
            .map(|index| index + 1)
            .unwrap_or_else(|| {
                if insert.after_id.is_none() {
                    0
                } else {
                    data.snapshot.order.len()
                }
            });
        data.snapshot.order.insert(position, insert.id.clone());
    }

    if let Some(project) = project {
        data.snapshot.project = project.clone();
    }
}

fn chat_message(room: &Room, client_id: &str, text: &str) -> Option<ChatMessage> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }
    let text: String = text.chars().take(MAX_CHAT_LENGTH).collect();
    let author_name = peer_name(room, client_id);
    Some(ChatMessage {
        id: Uuid::new_v4().simple().to_string(),
        author_id: client_id.to_string(),
        author_name,
        text,
        at: now_ms(),
    })
}

async fn send_json(
    sender: &mut SplitSink<WebSocket, Message>,
    message: &ServerMessage,
) -> Result<(), String> {
    let text = serde_json::to_string(message).map_err(|error| error.to_string())?;
    sender
        .send(Message::Text(text.into()))
        .await
        .map_err(|error| error.to_string())
}

fn can_rollback(role: &str, policy: &RoomPolicy) -> bool {
    role == "host" || (role == "editor" && policy.editors_can_rollback)
}

fn bundle_parts(value: &Value) -> (Vec<CollabLine>, Option<Vec<String>>) {
    let lines = value
        .get("lines")
        .cloned()
        .and_then(|lines| serde_json::from_value::<Vec<CollabLine>>(lines).ok())
        .unwrap_or_default();
    let order = value
        .get("order")
        .cloned()
        .and_then(|order| serde_json::from_value::<Vec<String>>(order).ok());
    (lines, order)
}

async fn handle_socket(socket: WebSocket, room: Arc<Room>, query: JoinQuery) {
    let client_id = Uuid::new_v4().simple().to_string();
    let requested_name = sanitize_name(query.name.as_deref().unwrap_or("Guest"));
    let guest_key = query.key.clone().unwrap_or_default();
    let host_connection = query
        .token
        .as_deref()
        .is_some_and(|token| token == room.host_token);
    // Subscribe before taking the snapshot so any patch applied while the
    // welcome packet is being sent is queued and delivered afterwards.
    let mut events = room.tx.subscribe();
    let (mut sender, mut receiver) = socket.split();

    let (role, require_approval, invite_id) = if host_connection {
        ("host".to_string(), false, None)
    } else {
        let validation = room.data.lock().ok().and_then(|data| {
            if !guest_key.is_empty() && data.bans.iter().any(|ban| ban.key == guest_key) {
                return Some(Err(
                    "You were removed from this room and cannot rejoin.".to_string(),
                ));
            }
            Some(validate_join(&data, &query))
        });
        match validation {
            Some(Ok(value)) => value,
            Some(Err(message)) => {
                let _ = send_json(&mut sender, &ServerMessage::Error { message }).await;
                return;
            }
            None => {
                let _ = send_json(
                    &mut sender,
                    &ServerMessage::Error {
                        message: "The room is unavailable.".to_string(),
                    },
                )
                .await;
                return;
            }
        }
    };

    let mut welcomed = false;
    if require_approval && !host_connection {
        let (wait_tx, mut wait_rx) = tokio::sync::mpsc::unbounded_channel();
        let waiting_meta = WaitingPeer {
            id: client_id.clone(),
            name: requested_name.clone(),
            color: PEER_COLORS[room
                .data
                .lock()
                .map(|data| data.peers.len())
                .unwrap_or(0)
                % PEER_COLORS.len()]
                .to_string(),
            at: now_ms(),
        };
        if let Ok(mut waiting) = room.waiting.lock() {
            waiting.push(WaitingEntry {
                meta: waiting_meta,
                role: role.clone(),
                invite_id: invite_id.clone(),
                key: guest_key.clone(),
                sender: wait_tx,
            });
        }
        let _ = send_json(
            &mut sender,
            &ServerMessage::Waiting {
                room_id: room.id.clone(),
            },
        )
        .await;
        broadcast_members(&room);

        loop {
            tokio::select! {
                approved = wait_rx.recv() => {
                    match approved {
                        Some(message) => {
                            let is_approved = matches!(message, ServerMessage::Approved { .. });
                            if send_json(&mut sender, &message).await.is_err() {
                                break;
                            }
                            if is_approved {
                                welcomed = true;
                                break;
                            }
                            // Denied: the Kicked message was delivered.
                            if let Ok(mut waiting) = room.waiting.lock() {
                                waiting.retain(|entry| entry.meta.id != client_id);
                            }
                            broadcast_members(&room);
                            return;
                        }
                        None => break,
                    }
                }
                incoming = receiver.next() => {
                    match incoming {
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Ok(Message::Ping(payload))) => {
                            let _ = sender.send(Message::Pong(payload)).await;
                        }
                        Some(Err(_)) => break,
                        _ => {}
                    }
                }
            }
        }

        if !welcomed {
            if let Ok(mut waiting) = room.waiting.lock() {
                waiting.retain(|entry| entry.meta.id != client_id);
            }
            broadcast_members(&room);
            return;
        }
    } else {
        let joined = match room.data.lock() {
            Ok(mut data) => {
                let peer = insert_peer(
                    &mut data,
                    &client_id,
                    &requested_name,
                    &guest_key,
                    &role,
                );
                use_invite(&mut data, invite_id.as_ref());
                push_history(
                    &mut data,
                    HistoryEntry {
                        id: Uuid::new_v4().simple().to_string(),
                        at: now_ms(),
                        author_id: peer.id.clone(),
                        author_name: peer.name.clone(),
                        kind: "role".to_string(),
                        summary: format!("{} joined as {}", peer.name, role),
                        line_ids: Vec::new(),
                        before: None,
                        after: None,
                        revert_of: None,
                    },
                );
                Some(data.peers.clone())
            }
            Err(_) => None,
        };
        if joined.is_none() {
            return;
        }
        if let Some(welcome) = build_welcome(&room, &client_id, &role) {
            if send_json(&mut sender, &welcome).await.is_err() {
                remove_peer(&room, &client_id);
                return;
            }
        }
        broadcast_members(&room);
    }

    loop {
        tokio::select! {
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        let is_ban = text.to_string().contains("\"type\":\"ban\"");
                        match serde_json::from_str::<ClientMessage>(&text.to_string()) {
                            Ok(ClientMessage::Patch { op_id, seq, lines, removed, order, inserts, project, history_kind, history_summary, revert_of }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                if !can_edit(&actor.role) {
                                    let _ = send_json(
                                        &mut sender,
                                        &ServerMessage::Permission {
                                            message: "Your role cannot edit lyrics or timing. Ask the host for editor access.".to_string(),
                                        },
                                    )
                                    .await;
                                    continue;
                                }
                                let now = now_ms();
                                let (applied, locks) = match room.data.lock() {
                                    Ok(mut data) => {
                                        let mut before_lines = Vec::new();
                                        for line in &lines {
                                            if let Some(existing) = data
                                                .snapshot
                                                .lines
                                                .iter()
                                                .find(|existing| existing.id == line.id)
                                            {
                                                before_lines.push(existing.clone());
                                            }
                                        }
                                        for removed_id in &removed {
                                            if let Some(existing) = data
                                                .snapshot
                                                .lines
                                                .iter()
                                                .find(|existing| existing.id == *removed_id)
                                            {
                                                before_lines.push(existing.clone());
                                            }
                                        }
                                        let order_touched = order.is_some()
                                            || !inserts.is_empty()
                                            || !removed.is_empty();
                                        let before_order = if order_touched {
                                            Some(data.snapshot.order.clone())
                                        } else {
                                            None
                                        };
                                        maybe_auto_restore_point(&mut data, now);
                                        apply_patch(
                                            &mut data,
                                            &lines,
                                            &removed,
                                            order.as_deref(),
                                            &inserts,
                                            project.as_ref(),
                                        );
                                        let after_order = if order_touched {
                                            Some(data.snapshot.order.clone())
                                        } else {
                                            None
                                        };
                                        let kind = history_kind.unwrap_or_else(|| {
                                            if !removed.is_empty() {
                                                "delete".to_string()
                                            } else if !inserts.is_empty() {
                                                "insert".to_string()
                                            } else if order.is_some() {
                                                "order".to_string()
                                            } else if project.is_some() && lines.is_empty() {
                                                "metadata".to_string()
                                            } else {
                                                "lyrics".to_string()
                                            }
                                        });
                                        let summary = history_summary.unwrap_or_else(|| {
                                            if !removed.is_empty() {
                                                format!("Removed {} line(s)", removed.len())
                                            } else if !inserts.is_empty() {
                                                format!("Inserted {} line(s)", inserts.len())
                                            } else if order.is_some() {
                                                "Reordered lines".to_string()
                                            } else {
                                                format!("Edited {} line(s)", lines.len())
                                            }
                                        });
                                        let mut line_ids: Vec<String> = lines
                                            .iter()
                                            .map(|line| line.id.clone())
                                            .collect();
                                        line_ids.extend(removed.iter().cloned());
                                        push_history(
                                            &mut data,
                                            HistoryEntry {
                                                id: Uuid::new_v4().simple().to_string(),
                                                at: now,
                                                author_id: actor.id.clone(),
                                                author_name: actor.name.clone(),
                                                kind,
                                                summary,
                                                line_ids,
                                                before: Some(line_bundle(
                                                    &before_lines,
                                                    before_order.as_deref(),
                                                )),
                                                after: Some(line_bundle(
                                                    &lines,
                                                    after_order.as_deref(),
                                                )),
                                                revert_of,
                                            },
                                        );
                                        let had_locks = data
                                            .locks
                                            .iter()
                                            .any(|lock| removed.contains(&lock.line_id));
                                        data.locks.retain(|lock| !removed.contains(&lock.line_id));
                                        let locks = if had_locks {
                                            Some(lock_snapshot(&data, now))
                                        } else {
                                            None
                                        };
                                        (true, locks)
                                    }
                                    Err(_) => (false, None),
                                };
                                if applied {
                                    let _ = room.tx.send(ServerMessage::Patch {
                                        from: client_id.clone(),
                                        op_id,
                                        seq,
                                        lines,
                                        removed,
                                        order,
                                        inserts,
                                        project,
                                    });
                                    if let Some(locks) = locks {
                                        let _ = room.tx.send(ServerMessage::Locks { locks });
                                    }
                                    broadcast_history(&room);
                                }
                            }
                            Ok(ClientMessage::Chat { text }) => {
                                if let Some(message) = chat_message(&room, &client_id, &text) {
                                    if let Ok(mut data) = room.data.lock() {
                                        data.chat.push(message.clone());
                                        if data.chat.len() > MAX_CHAT_MESSAGES {
                                            let excess = data.chat.len() - MAX_CHAT_MESSAGES;
                                            data.chat.drain(0..excess);
                                        }
                                    }
                                    let _ = room.tx.send(ServerMessage::Chat { message });
                                }
                            }
                            Ok(ClientMessage::Rename { name }) => {
                                rename_peer(&room, &client_id, &name);
                            }
                            Ok(ClientMessage::Lock { line_ids }) => {
                                let role = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .unwrap_or_default();
                                if can_edit(&role) {
                                    set_peer_locks(&room, &client_id, &line_ids);
                                }
                            }
                            Ok(ClientMessage::Ping { at }) => {
                                prune_expired_locks(&room);
                                let _ = send_json(&mut sender, &ServerMessage::Pong { at }).await;
                            }
                            Ok(ClientMessage::Focus { line_id, word_id }) => {
                                if let Ok(data) = room.data.lock() {
                                    if let Some(peer) = peer_of(&data, &client_id) {
                                        let message = ServerMessage::Focus {
                                            from: peer.id,
                                            name: peer.name,
                                            color: peer.color,
                                            line_id,
                                            word_id,
                                            at: now_ms(),
                                        };
                                        drop(data);
                                        let _ = room.tx.send(message);
                                    }
                                }
                            }
                            Ok(ClientMessage::SetRole { client_id: target_id, role }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                if actor.as_ref().is_none_or(|actor| actor.role != "host") {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can change roles.".to_string() }).await;
                                    continue;
                                }
                                if !matches!(role.as_str(), "editor" | "commenter" | "viewer") {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Use hand over host to make someone the host.".to_string() }).await;
                                    continue;
                                }
                                let mut changed_name = None;
                                if let Ok(mut data) = room.data.lock() {
                                    if let Some(peer) = data.peers.iter_mut().find(|peer| peer.id == target_id) {
                                        peer.role = role.clone();
                                        changed_name = Some(peer.name.clone());
                                    }
                                }
                                if let Some(name) = changed_name {
                                    if let Ok(mut data) = room.data.lock() {
                                        push_history(&mut data, HistoryEntry {
                                            id: Uuid::new_v4().simple().to_string(),
                                            at: now_ms(),
                                            author_id: actor.as_ref().map(|actor| actor.id.clone()).unwrap_or_default(),
                                            author_name: actor.as_ref().map(|actor| actor.name.clone()).unwrap_or_else(|| "Host".to_string()),
                                            kind: "role".to_string(),
                                            summary: format!("{name} is now {role}"),
                                            line_ids: Vec::new(),
                                            before: None,
                                            after: None,
                                            revert_of: None,
                                        });
                                    }
                                    broadcast_members(&room);
                                    broadcast_history(&room);
                                }
                            }
                            Ok(ClientMessage::TransferHost { client_id: target_id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can hand over the room.".to_string() }).await;
                                    continue;
                                }
                                let mut transferred = None;
                                if let Ok(mut data) = room.data.lock() {
                                    if data.peers.iter().any(|peer| peer.id == target_id) {
                                        if let Some(previous) = data.peers.iter_mut().find(|peer| peer.id == client_id) {
                                            previous.role = "editor".to_string();
                                        }
                                        if let Some(next) = data.peers.iter_mut().find(|peer| peer.id == target_id) {
                                            next.role = "host".to_string();
                                            transferred = Some(next.name.clone());
                                        }
                                    }
                                }
                                if let Some(name) = transferred {
                                    if let Ok(mut data) = room.data.lock() {
                                        let author = actor_name(&data, &client_id);
                                        push_history(&mut data, HistoryEntry {
                                            id: Uuid::new_v4().simple().to_string(),
                                            at: now_ms(),
                                            author_id: client_id.clone(),
                                            author_name: author,
                                            kind: "role".to_string(),
                                            summary: format!("Host handed over to {name}"),
                                            line_ids: Vec::new(),
                                            before: None,
                                            after: None,
                                            revert_of: None,
                                        });
                                    }
                                    broadcast_members(&room);
                                    broadcast_history(&room);
                                }
                            }
                            Ok(ClientMessage::InviteCreate { label, password, role, expires_in_ms, max_uses, require_approval }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can create invites.".to_string() }).await;
                                    continue;
                                }
                                if !matches!(role.as_str(), "editor" | "commenter" | "viewer") {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Choose Editor, Commenter, or Viewer for an invite.".to_string() }).await;
                                    continue;
                                }
                                let code = invite_code();
                                let now = now_ms();
                                let entry = InviteEntry {
                                    meta: Invite {
                                        id: Uuid::new_v4().simple().to_string(),
                                        code: code.clone(),
                                        label: label.map(|value| value.chars().take(80).collect()),
                                        role,
                                        expires_at: expires_in_ms.map(|ms| now + ms.clamp(60_000, 30 * 24 * 60 * 60 * 1000)),
                                        max_uses: max_uses.map(|uses| uses.clamp(1, 500)),
                                        uses: 0,
                                        created_at: now,
                                        revoked: false,
                                        has_password: password.as_deref().is_some_and(|value| !value.is_empty()),
                                        require_approval: require_approval.unwrap_or(false),
                                    },
                                    password_hash: password
                                        .filter(|value| !value.is_empty())
                                        .map(|value| hash_invite_password(&code, &value)),
                                };
                                if let Ok(mut data) = room.data.lock() {
                                    data.invites.push(entry);
                                    if data.invites.len() > MAX_INVITES {
                                        let excess = data.invites.len() - MAX_INVITES;
                                        data.invites.drain(0..excess);
                                    }
                                    let author = actor_name(&data, &client_id);
                                    push_history(&mut data, HistoryEntry {
                                        id: Uuid::new_v4().simple().to_string(),
                                        at: now,
                                        author_id: client_id.clone(),
                                        author_name: author,
                                        kind: "invite".to_string(),
                                        summary: "Created an invite link".to_string(),
                                        line_ids: Vec::new(),
                                        before: None,
                                        after: None,
                                        revert_of: None,
                                    });
                                }
                                broadcast_invites(&room);
                                broadcast_history(&room);
                            }
                            Ok(ClientMessage::InviteRevoke { invite_id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can revoke invites.".to_string() }).await;
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    if let Some(invite) = data.invites.iter_mut().find(|invite| invite.meta.id == invite_id) {
                                        invite.meta.revoked = true;
                                    }
                                }
                                broadcast_invites(&room);
                            }
                            Ok(ClientMessage::Kick { client_id: target_id })
                            | Ok(ClientMessage::Ban { client_id: target_id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can remove people.".to_string() }).await;
                                    continue;
                                }
                                let ban = is_ban;
                                let target = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &target_id));
                                if let Some(target) = target {
                                    if let Ok(mut data) = room.data.lock() {
                                        data.peers.retain(|peer| peer.id != target_id);
                                        if ban && !target.key.is_empty() {
                                            data.bans.push(BanEntry {
                                                key: target.key.clone(),
                                                name: target.name.clone(),
                                            });
                                        }
                                        let author = actor_name(&data, &client_id);
                                        push_history(&mut data, HistoryEntry {
                                            id: Uuid::new_v4().simple().to_string(),
                                            at: now_ms(),
                                            author_id: client_id.clone(),
                                            author_name: author,
                                            kind: "role".to_string(),
                                            summary: if ban {
                                                format!("Banned {}", target.name)
                                            } else {
                                                format!("Removed {}", target.name)
                                            },
                                            line_ids: Vec::new(),
                                            before: None,
                                            after: None,
                                            revert_of: None,
                                        });
                                    }
                                    let _ = room.tx.send(ServerMessage::Kicked {
                                        client_id: target_id.clone(),
                                        reason: if ban {
                                            "The host removed you from this room and blocked you from rejoining.".to_string()
                                        } else {
                                            "The host removed you from this room.".to_string()
                                        },
                                    });
                                    broadcast_members(&room);
                                    broadcast_history(&room);
                                    broadcast_invites(&room);
                                }
                            }
                            Ok(ClientMessage::LockRoom { locked }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can lock the room.".to_string() }).await;
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    data.policy.locked = locked;
                                }
                                broadcast_policy(&room);
                            }
                            Ok(ClientMessage::Approve { client_id: target_id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can approve people.".to_string() }).await;
                                    continue;
                                }
                                let entry = room.waiting.lock().ok().and_then(|mut waiting| {
                                    waiting
                                        .iter()
                                        .position(|entry| entry.meta.id == target_id)
                                        .map(|index| waiting.remove(index))
                                });
                                if let Some(entry) = entry {
                                    let approved = match room.data.lock() {
                                        Ok(mut data) => {
                                            insert_peer(
                                                &mut data,
                                                &entry.meta.id,
                                                &entry.meta.name,
                                                &entry.key,
                                                &entry.role,
                                            );
                                            use_invite(&mut data, entry.invite_id.as_ref());
                                            Some(ServerMessage::Approved {
                                                client_id: entry.meta.id.clone(),
                                                snapshot: data.snapshot.clone(),
                                                role: entry.role.clone(),
                                                members: data.peers.clone(),
                                                comments: data.comments.clone(),
                                                review_marks: data.review_marks.clone(),
                                                history: data.history.clone(),
                                                restore_points: data
                                                    .restore_points
                                                    .iter()
                                                    .map(|point| point.meta.clone())
                                                    .collect(),
                                                policy: data.policy.clone(),
                                                waiting: Vec::new(),
                                                split_dictionary: data.split_dictionary.clone(),
                                            })
                                        }
                                        Err(_) => None,
                                    };
                                    if let Some(approved) = approved {
                                        let _ = entry.sender.send(approved);
                                        broadcast_members(&room);
                                        broadcast_invites(&room);
                                    }
                                }
                            }
                            Ok(ClientMessage::Deny { client_id: target_id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can deny people.".to_string() }).await;
                                    continue;
                                }
                                let entry = room.waiting.lock().ok().and_then(|mut waiting| {
                                    waiting
                                        .iter()
                                        .position(|entry| entry.meta.id == target_id)
                                        .map(|index| waiting.remove(index))
                                });
                                if let Some(entry) = entry {
                                    let _ = entry.sender.send(ServerMessage::Kicked {
                                        client_id: target_id,
                                        reason: "The host did not admit you to this room.".to_string(),
                                    });
                                    broadcast_members(&room);
                                }
                            }
                            Ok(ClientMessage::SetPolicy { default_role, editors_can_rollback, approve_joiners }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can change room settings.".to_string() }).await;
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    if let Some(role) = default_role.filter(|role| matches!(role.as_str(), "editor" | "commenter" | "viewer")) {
                                        data.policy.default_role = role;
                                    }
                                    if let Some(value) = editors_can_rollback {
                                        data.policy.editors_can_rollback = value;
                                    }
                                    if let Some(value) = approve_joiners {
                                        data.policy.approve_joiners = value;
                                    }
                                    let author = actor_name(&data, &client_id);
                                    push_history(&mut data, HistoryEntry {
                                        id: Uuid::new_v4().simple().to_string(),
                                        at: now_ms(),
                                        author_id: client_id.clone(),
                                        author_name: author,
                                        kind: "policy".to_string(),
                                        summary: "Changed room settings".to_string(),
                                        line_ids: Vec::new(),
                                        before: None,
                                        after: None,
                                        revert_of: None,
                                    });
                                }
                                broadcast_policy(&room);
                                broadcast_history(&room);
                            }
                            Ok(ClientMessage::Comment { action, comment_id, line_id, word_id, parent_id, text: comment_text, resolved }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                if !can_comment(&actor.role) {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Viewers can't add comments. Ask the host for commenter access.".to_string() }).await;
                                    continue;
                                }
                                let mut changed = false;
                                if let Ok(mut data) = room.data.lock() {
                                    match action.as_str() {
                                        "create" => {
                                            let Some(line_id) = line_id else { continue; };
                                            let Some(raw) = comment_text else { continue; };
                                            let text: String = raw.trim().chars().take(MAX_COMMENT_LENGTH).collect();
                                            if text.is_empty() || !data.snapshot.lines.iter().any(|line| line.id == line_id) {
                                                continue;
                                            }
                                            data.comments.push(Comment {
                                                id: Uuid::new_v4().simple().to_string(),
                                                line_id: line_id.clone(),
                                                word_id,
                                                parent_id,
                                                author_id: actor.id.clone(),
                                                author_name: actor.name.clone(),
                                                author_color: actor.color.clone(),
                                                text,
                                                at: now_ms(),
                                                edited_at: None,
                                                resolved: false,
                                                resolved_by: None,
                                                resolved_at: None,
                                            });
                                            if data.comments.len() > MAX_COMMENTS {
                                                let excess = data.comments.len() - MAX_COMMENTS;
                                                data.comments.drain(0..excess);
                                            }
                                            push_history(&mut data, HistoryEntry {
                                                id: Uuid::new_v4().simple().to_string(),
                                                at: now_ms(),
                                                author_id: actor.id.clone(),
                                                author_name: actor.name.clone(),
                                                kind: "comment".to_string(),
                                                summary: "Added a comment".to_string(),
                                                line_ids: vec![line_id],
                                                before: None,
                                                after: None,
                                                revert_of: None,
                                            });
                                            changed = true;
                                        }
                                        "edit" => {
                                            let Some(comment_id) = comment_id else { continue; };
                                            let Some(raw) = comment_text else { continue; };
                                            if let Some(comment) = data.comments.iter_mut().find(|comment| comment.id == comment_id) {
                                                if comment.author_id == actor.id || actor.role == "host" {
                                                    comment.text = raw.trim().chars().take(MAX_COMMENT_LENGTH).collect();
                                                    comment.edited_at = Some(now_ms());
                                                    changed = true;
                                                }
                                            }
                                        }
                                        "delete" => {
                                            let Some(comment_id) = comment_id else { continue; };
                                            let allowed = data.comments.iter().any(|comment| {
                                                comment.id == comment_id
                                                    && (comment.author_id == actor.id || actor.role == "host")
                                            });
                                            if allowed {
                                                data.comments.retain(|comment| {
                                                    comment.id != comment_id && comment.parent_id.as_deref() != Some(comment_id.as_str())
                                                });
                                                changed = true;
                                            }
                                        }
                                        "resolve" => {
                                            let Some(comment_id) = comment_id else { continue; };
                                            let resolved = resolved.unwrap_or(true);
                                            if let Some(comment) = data.comments.iter_mut().find(|comment| comment.id == comment_id) {
                                                if comment.author_id == actor.id || actor.role == "host" || actor.role == "editor" {
                                                    comment.resolved = resolved;
                                                    comment.resolved_by = Some(actor.name.clone());
                                                    comment.resolved_at = resolved.then(now_ms);
                                                    changed = true;
                                                }
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                                if changed {
                                    broadcast_comments(&room);
                                    broadcast_history(&room);
                                }
                            }
                            Ok(ClientMessage::ShareSplit { id, word_key, display_word, boundaries, label, note }) => {
                                let role = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id));
                                if !role
                                    .as_deref()
                                    .is_some_and(|role| role == "host" || role == "editor")
                                {
                                    let _ = send_json(
                                        &mut sender,
                                        &ServerMessage::Permission {
                                            message: "Only editors and the host can share splits with the room.".to_string(),
                                        },
                                    )
                                    .await;
                                    continue;
                                }
                                let clean_word = display_word.trim().chars().take(80).collect::<String>();
                                let clean_key = word_key.trim().to_lowercase().chars().take(80).collect::<String>();
                                let mut valid = boundaries;
                                valid.retain(|boundary| *boundary > 0 && *boundary < 200);
                                valid.sort_unstable();
                                valid.dedup();
                                if clean_word.is_empty() || valid.is_empty() {
                                    let _ = send_json(
                                        &mut sender,
                                        &ServerMessage::Error {
                                            message: "A shared split needs a word and at least one split point.".to_string(),
                                        },
                                    )
                                    .await;
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    let duplicate = data.split_dictionary.iter().any(|entry| {
                                        entry.word_key == clean_key && entry.boundaries == valid
                                    });
                                    if !duplicate && data.split_dictionary.len() < 500 {
                                        let author = actor_name(&data, &client_id);
                                        data.split_dictionary.push(SharedSplit {
                                            id: if id.trim().is_empty() {
                                                Uuid::new_v4().simple().to_string()
                                            } else {
                                                id.chars().take(64).collect()
                                            },
                                            word_key: clean_key,
                                            display_word: clean_word,
                                            boundaries: valid,
                                            label: label.trim().chars().take(80).collect(),
                                            note: note.trim().chars().take(500).collect(),
                                            added_by_id: client_id.clone(),
                                            added_by_name: author,
                                            created_at: now_ms(),
                                        });
                                    }
                                }
                                broadcast_split_dictionary(&room);
                            }
                            Ok(ClientMessage::RemoveSharedSplit { id }) => {
                                let is_host = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| role_of(&data, &client_id))
                                    .is_some_and(|role| role == "host");
                                if !is_host {
                                    let _ = send_json(
                                        &mut sender,
                                        &ServerMessage::Permission {
                                            message: "Only the host can remove shared splits.".to_string(),
                                        },
                                    )
                                    .await;
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    data.split_dictionary.retain(|entry| entry.id != id);
                                }
                                broadcast_split_dictionary(&room);
                            }
                            Ok(ClientMessage::ReviewMark { line_id, status, note }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                if !can_comment(&actor.role) {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Viewers can't review lines. Ask the host for commenter access.".to_string() }).await;
                                    continue;
                                }
                                if !matches!(status.as_str(), "ok" | "needs-fix" | "unsure") {
                                    continue;
                                }
                                if let Ok(mut data) = room.data.lock() {
                                    if !data.snapshot.lines.iter().any(|line| line.id == line_id) {
                                        continue;
                                    }
                                    data.review_marks.retain(|mark| !(mark.line_id == line_id && mark.author_id == actor.id));
                                    data.review_marks.push(ReviewMark {
                                        line_id: line_id.clone(),
                                        status: status.clone(),
                                        note: note.map(|value| value.chars().take(MAX_REVIEW_NOTE).collect()),
                                        author_id: actor.id.clone(),
                                        author_name: actor.name.clone(),
                                        at: now_ms(),
                                    });
                                    push_history(&mut data, HistoryEntry {
                                        id: Uuid::new_v4().simple().to_string(),
                                        at: now_ms(),
                                        author_id: actor.id.clone(),
                                        author_name: actor.name.clone(),
                                        kind: "review".to_string(),
                                        summary: format!("Marked a line as {status}"),
                                        line_ids: vec![line_id],
                                        before: None,
                                        after: None,
                                        revert_of: None,
                                    });
                                }
                                broadcast_review(&room);
                                broadcast_history(&room);
                            }
                            Ok(ClientMessage::RestorePoint { name }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                let mut allowed = false;
                                if let Ok(mut data) = room.data.lock() {
                                    allowed = can_rollback(&actor.role, &data.policy);
                                    if allowed {
                                        let line_count = data.snapshot.lines.len();
                                        let snapshot = data.snapshot.clone();
                                        let meta = RestorePoint {
                                            id: Uuid::new_v4().simple().to_string(),
                                            name: if name.trim().is_empty() {
                                                "Named restore point".to_string()
                                            } else {
                                                name.trim().chars().take(80).collect()
                                            },
                                            at: now_ms(),
                                            author_name: actor.name.clone(),
                                            line_count,
                                            automatic: false,
                                        };
                                        data.restore_points.push(RestoreEntry {
                                            meta,
                                            snapshot,
                                        });
                                        data.last_restore_at = now_ms();
                                        prune_restore_points(&mut data);
                                    }
                                }
                                if !allowed {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can create restore points.".to_string() }).await;
                                    continue;
                                }
                                broadcast_history(&room);
                            }
                            Ok(ClientMessage::Restore { restore_point_id }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                let mut snapshot = None;
                                if let Ok(mut data) = room.data.lock() {
                                    if !can_rollback(&actor.role, &data.policy) {
                                        // handled below
                                    } else if let Some(point) = data.restore_points.iter().find(|point| point.meta.id == restore_point_id).cloned() {
                                        let current_snapshot = data.snapshot.clone();
                                        let current_line_count = data.snapshot.lines.len();
                                        let restored_name = point.meta.name.clone();
                                        let before = RestoreEntry {
                                            meta: RestorePoint {
                                                id: Uuid::new_v4().simple().to_string(),
                                                name: "Before rollback".to_string(),
                                                at: now_ms(),
                                                author_name: actor.name.clone(),
                                                line_count: current_line_count,
                                                automatic: true,
                                            },
                                            snapshot: current_snapshot,
                                        };
                                        data.restore_points.push(before);
                                        data.snapshot = point.snapshot;
                                        snapshot = Some(data.snapshot.clone());
                                        push_history(&mut data, HistoryEntry {
                                            id: Uuid::new_v4().simple().to_string(),
                                            at: now_ms(),
                                            author_id: actor.id.clone(),
                                            author_name: actor.name.clone(),
                                            kind: "rollback".to_string(),
                                            summary: format!("Restored \"{restored_name}\""),
                                            line_ids: Vec::new(),
                                            before: None,
                                            after: None,
                                            revert_of: None,
                                        });
                                        prune_restore_points(&mut data);
                                    }
                                }
                                match snapshot {
                                    Some(snapshot) => {
                                        let _ = room.tx.send(ServerMessage::Snapshot { snapshot });
                                        broadcast_history(&room);
                                    }
                                    None => {
                                        let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can roll back changes in this room.".to_string() }).await;
                                    }
                                }
                            }
                            Ok(ClientMessage::Revert { history_id }) => {
                                let actor = room
                                    .data
                                    .lock()
                                    .ok()
                                    .and_then(|data| peer_of(&data, &client_id));
                                let Some(actor) = actor else { break; };
                                let mut patch = None;
                                if let Ok(mut data) = room.data.lock() {
                                    if can_rollback(&actor.role, &data.policy) {
                                        if let Some(entry) = data.history.iter().find(|entry| entry.id == history_id).cloned() {
                                            if let (Some(before), Some(after)) = (entry.before.as_ref(), entry.after.as_ref()) {
                                                let (restored, order) = bundle_parts(before);
                                                let (applied, _) = bundle_parts(after);
                                                let before_ids: HashSet<String> = restored.iter().map(|line| line.id.clone()).collect();
                                                let after_ids: HashSet<String> = applied.iter().map(|line| line.id.clone()).collect();
                                                let removed: Vec<String> = after_ids.difference(&before_ids).cloned().collect();
                                                let current_snapshot = data.snapshot.clone();
                                                let current_line_count = data.snapshot.lines.len();
                                                data.restore_points.push(RestoreEntry {
                                                    meta: RestorePoint {
                                                        id: Uuid::new_v4().simple().to_string(),
                                                        name: "Before revert".to_string(),
                                                        at: now_ms(),
                                                        author_name: actor.name.clone(),
                                                        line_count: current_line_count,
                                                        automatic: true,
                                                    },
                                                    snapshot: current_snapshot,
                                                });
                                                apply_patch(&mut data, &restored, &removed, order.as_deref(), &[], None);
                                                patch = Some((restored, removed, order));
                                                push_history(&mut data, HistoryEntry {
                                                    id: Uuid::new_v4().simple().to_string(),
                                                    at: now_ms(),
                                                    author_id: actor.id.clone(),
                                                    author_name: actor.name.clone(),
                                                    kind: "rollback".to_string(),
                                                    summary: format!("Reverted: {}", entry.summary),
                                                    line_ids: entry.line_ids.clone(),
                                                    before: entry.after.clone(),
                                                    after: entry.before.clone(),
                                                    revert_of: Some(entry.id.clone()),
                                                });
                                                prune_restore_points(&mut data);
                                            }
                                        }
                                    }
                                }
                                if let Some((lines, removed, order)) = patch {
                                    let _ = room.tx.send(ServerMessage::Patch {
                                        from: "rollback".to_string(),
                                        op_id: Some(Uuid::new_v4().simple().to_string()),
                                        seq: None,
                                        lines,
                                        removed,
                                        order,
                                        inserts: Vec::new(),
                                        project: None,
                                    });
                                    broadcast_history(&room);
                                } else {
                                    let _ = send_json(&mut sender, &ServerMessage::Permission { message: "Only the host can roll back changes in this room.".to_string() }).await;
                                }
                            }
                            Err(_) => {
                                let _ = send_json(
                                    &mut sender,
                                    &ServerMessage::Error {
                                        message: "That collaboration message was invalid.".to_string(),
                                    },
                                )
                                .await;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = sender.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
            event = events.recv() => {
                match event {
                    Ok(message) => {
                        if send_json(&mut sender, &message).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        let _ = send_json(
                            &mut sender,
                            &ServerMessage::Error {
                                message: "The room changed too quickly. Reconnecting to resync.".to_string(),
                            },
                        )
                        .await;
                        break;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }

    remove_peer(&room, &client_id);
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<JoinQuery>,
    State(room): State<Arc<Room>>,
) -> Response {
    if query.room.as_deref() != Some(room.id.as_str()) {
        return ws.on_upgrade(|mut socket| async move {
            let message = ServerMessage::Error {
                message: "This collaboration link is not valid.".to_string(),
            };
            if let Ok(text) = serde_json::to_string(&message) {
                let _ = socket.send(Message::Text(text.into())).await;
            }
            let _ = socket.close().await;
        });
    }

    ws.on_upgrade(move |socket| handle_socket(socket, room, query))
}

fn media_content_type(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" => "video/mp4",
        "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        "ogg" | "opus" => "audio/ogg",
        _ => "application/octet-stream",
    }
}

fn not_found() -> Response {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Shared file not found."))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

async fn media_preflight() -> Response {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-methods", "GET, OPTIONS")
        .header("access-control-allow-headers", "*")
        .header("access-control-allow-private-network", "true")
        .header("access-control-max-age", "600")
        .header("cross-origin-resource-policy", "cross-origin")
        .body(Body::empty())
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

async fn media_handler(
    AxumPath(id): AxumPath<String>,
    Query(query): Query<JoinQuery>,
    State(room): State<Arc<Room>>,
) -> Response {
    if query.room.as_deref() != Some(room.id.as_str())
        || id.is_empty()
        || !id.chars().all(|character| character.is_ascii_alphanumeric())
    {
        return not_found();
    }
    let entry = room.data.lock().ok().and_then(|data| {
        data.media
            .iter()
            .find(|entry| entry.meta.id == id)
            .cloned()
    });
    let Some(entry) = entry else {
        return not_found();
    };
    let file = match tokio::fs::File::open(&entry.path).await {
        Ok(file) => file,
        Err(_) => return not_found(),
    };
    let size = match file.metadata().await {
        Ok(metadata) => metadata.len(),
        Err(_) => return not_found(),
    };
    let extension = entry
        .path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("bin");
    let fallback_name = format!("shared-file.{extension}");
    let ascii_name: String = entry
        .meta
        .name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || matches!(character, ' ' | '.' | '-' | '_' | '(' | ')')
            {
                character
            } else {
                '_'
            }
        })
        .collect();
    let file_name = if ascii_name.trim().is_empty() {
        fallback_name
    } else {
        ascii_name
    };
    let disposition = format!("attachment; filename=\"{file_name}\"");
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, media_content_type(&entry.path))
        .header(CONTENT_LENGTH, size.to_string())
        .header(CONTENT_DISPOSITION, disposition)
        .header(CACHE_CONTROL, "no-store")
        .header("x-content-type-options", "nosniff")
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-methods", "GET, OPTIONS")
        .header("access-control-allow-private-network", "true")
        .header("cross-origin-resource-policy", "cross-origin")
        .body(Body::from_stream(ReaderStream::new(file)))
        .unwrap_or_else(|_| not_found())
}

#[tauri::command]
pub fn share_collab_media(
    state: TauriState<'_, CollabServerState>,
    path: String,
    name: String,
    kind: String,
) -> Result<Vec<SharedMedia>, String> {
    let running = state
        .running
        .lock()
        .map_err(|_| "Collaboration server state is unavailable.".to_string())?;
    let server = running
        .as_ref()
        .ok_or_else(|| "Start a live room before sharing a file.".to_string())?;
    let canonical = std::fs::canonicalize(&path)
        .map_err(|error| format!("That file is no longer available: {error}"))?;
    let metadata = std::fs::metadata(&canonical)
        .map_err(|error| format!("Could not read that file: {error}"))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err("That file is empty or unavailable.".to_string());
    }
    let kind = match kind.as_str() {
        "recording" => "recording",
        _ => "audio",
    };
    let trimmed: String = name.trim().chars().take(120).collect();
    let fallback = canonical
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Shared file".to_string());
    let entry = MediaEntry {
        meta: SharedMedia {
            id: Uuid::new_v4().simple().to_string(),
            name: if trimmed.is_empty() {
                fallback
            } else {
                trimmed
            },
            kind: kind.to_string(),
            size: metadata.len(),
            added_by: "Host".to_string(),
            at: now_ms(),
        },
        path: canonical.clone(),
    };
    let media = {
        let mut data = server
            .room
            .data
            .lock()
            .map_err(|_| "The live room is unavailable.".to_string())?;
        // Re-sharing the same file should not create duplicate download rows.
        data.media.retain(|existing| existing.path != canonical);
        data.media.push(entry);
        if data.media.len() > 32 {
            let excess = data.media.len() - 32;
            data.media.drain(0..excess);
        }
        data.media
            .iter()
            .map(|entry| entry.meta.clone())
            .collect::<Vec<_>>()
    };
    let _ = server
        .room
        .tx
        .send(ServerMessage::Media { media: media.clone() });
    if let Ok(mut data) = server.room.data.lock() {
        push_history(
            &mut data,
            HistoryEntry {
                id: Uuid::new_v4().simple().to_string(),
                at: now_ms(),
                author_id: "host".to_string(),
                author_name: "Host".to_string(),
                kind: "audio".to_string(),
                summary: "Shared song audio".to_string(),
                line_ids: Vec::new(),
                before: None,
                after: None,
                revert_of: None,
            },
        );
    }
    broadcast_history(&server.room);
    Ok(media)
}

fn build_app(room: Arc<Room>, web_dir: PathBuf) -> Router {
    Router::new()
        .route("/collab/ws", get(ws_handler))
        .route(
            "/collab/media/{id}",
            get(media_handler).options(media_preflight),
        )
        .with_state(room)
        .fallback_service(
            ServeDir::new(web_dir.clone())
                .fallback(ServeFile::new(web_dir.join("index.html"))),
        )
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("cross-origin-opener-policy"),
            HeaderValue::from_static("same-origin"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("cross-origin-embedder-policy"),
            HeaderValue::from_static("require-corp"),
        ))
}

#[tauri::command]
pub async fn start_collab_server(
    app: AppHandle,
    state: TauriState<'_, CollabServerState>,
    snapshot: Value,
    remote: bool,
) -> Result<CollabSession, String> {
    {
        let running = state
            .running
            .lock()
            .map_err(|_| "Collaboration server state is unavailable.".to_string())?;
        if running.is_some() {
            return Err("A collaboration room is already running.".to_string());
        }
    }

    let snapshot: CollabSnapshot = serde_json::from_value(snapshot)
        .map_err(|error| format!("Invalid collaboration snapshot: {error}"))?;
    let web_dir = resolve_web_dir(&app)?;
    let room_id = Uuid::new_v4().simple().to_string()[..12].to_string();
    let host_token = Uuid::new_v4().simple().to_string();
    let (tx, _) = broadcast::channel(512);
    let room = Arc::new(Room {
        id: room_id.clone(),
        data: Arc::new(Mutex::new(RoomData {
            snapshot,
            ..Default::default()
        })),
        tx,
        waiting: Mutex::new(Vec::new()),
        host_token: host_token.clone(),
    });

    let server_room = Arc::clone(&room);
    let app_router = build_app(room, web_dir);

    let bind_address = if remote {
        Ipv4Addr::LOCALHOST
    } else {
        Ipv4Addr::UNSPECIFIED
    };
    let listener = tokio::net::TcpListener::bind((bind_address, 0))
        .await
        .map_err(|error| format!("Could not start the collaboration server: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Could not determine the collaboration port: {error}"))?
        .port();
    let (shutdown, shutdown_rx) = oneshot::channel::<()>();
    let task = tauri::async_runtime::spawn(async move {
        let server = axum::serve(listener, app_router).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });
        if let Err(error) = server.await {
            log::error!("Collaboration server stopped: {error}");
        }
    });

    let (tunnel_child, tunnel_url) = if remote {
        match start_cloudflared(&app, port).await {
            Ok((child, url)) => (Some(child), Some(url)),
            Err(error) => {
                let _ = shutdown.send(());
                task.abort();
                return Err(error);
            }
        }
    } else {
        (None, None)
    };

    let lan_ip = local_ip();
    let url = if let Some(tunnel_url) = tunnel_url.as_deref() {
        format!(
            "{}/?collabRoom={room_id}",
            tunnel_url.trim_end_matches('/')
        )
    } else {
        format!("http://{lan_ip}:{port}/?collabRoom={room_id}")
    };
    let session = CollabSession {
        url,
        local_url: format!("http://127.0.0.1:{port}/?collabRoom={room_id}"),
        ws_url: format!(
            "ws://127.0.0.1:{port}/collab/ws?room={room_id}&token={host_token}"
        ),
        room_id,
        port,
        lan_ip,
        remote,
    };

    let mut running = state
        .running
        .lock()
        .map_err(|_| "Collaboration server state is unavailable.".to_string())?;
    if running.is_some() {
        let _ = shutdown.send(());
        task.abort();
        if let Some(mut tunnel) = tunnel_child {
            terminate(&mut tunnel);
        }
        return Err("A collaboration room is already running.".to_string());
    }
    *running = Some(RunningServer {
        shutdown: Some(shutdown),
        task,
        tunnel: tunnel_child,
        room: server_room,
    });
    Ok(session)
}

#[tauri::command]
pub fn stop_collab_server(state: TauriState<'_, CollabServerState>) -> Result<(), String> {
    shutdown(state.inner());
    Ok(())
}

pub(crate) fn shutdown(state: &CollabServerState) {
    match state.running.lock() {
        Ok(mut running) => {
            if let Some(server) = running.take() {
                drop(server);
            }
        }
        Err(_) => log::warn!("Collaboration server state was poisoned during shutdown."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tokio_tungstenite::tungstenite::Message as WsMessage;

    async fn next_message<S>(socket: &mut S, kind: &str) -> Value
    where
        S: futures_util::Stream<
                Item = Result<WsMessage, tokio_tungstenite::tungstenite::Error>,
            > + Unpin,
    {
        loop {
            let message = tokio::time::timeout(
                std::time::Duration::from_secs(3),
                socket.next(),
            )
            .await
            .expect("timed out waiting for a collaboration message")
            .expect("the collaboration socket closed")
            .expect("the collaboration socket failed");
            if let WsMessage::Text(text) = message {
                let value: Value = serde_json::from_str(text.as_str()).unwrap();
                if value["type"] == kind {
                    return value;
                }
            }
        }
    }

    fn line(id: &str, text: &str) -> CollabLine {
        CollabLine {
            id: id.to_string(),
            data: json!({ "id": id, "words": [{ "word": text }] }),
        }
    }

    fn room_data() -> RoomData {
        RoomData {
            snapshot: CollabSnapshot {
                lines: vec![line("a", "one")],
                order: vec!["a".to_string()],
                project: json!({ "metadata": [] }),
            },
            ..Default::default()
        }
    }

    #[test]
    fn expires_stale_line_locks() {
        let mut data = room_data();
        data.peers.push(Peer {
            id: "alex".to_string(),
            name: "Alex".to_string(),
            color: "#60a5fa".to_string(),
            role: "host".to_string(),
            joined_at: 0,
            online: true,
            key: String::new(),
        });
        data.locks.push(LockEntry {
            line_id: "a".to_string(),
            client_id: "alex".to_string(),
            expires_at: 10,
        });
        assert!(prune_locks(&mut data, 20));
        assert!(lock_snapshot(&data, 20).is_empty());
    }

    #[test]
    fn applies_line_changes_and_preserves_order() {
        let mut data = room_data();
        apply_patch(
            &mut data,
            &[line("b", "two")],
            &[],
            Some(&["a".to_string(), "b".to_string()]),
            &[],
            None,
        );
        assert_eq!(data.snapshot.order, vec!["a", "b"]);
        assert_eq!(data.snapshot.lines.len(), 2);
    }

    #[test]
    fn removes_lines_and_updates_project() {
        let mut data = room_data();
        apply_patch(
            &mut data,
            &[],
            &["a".to_string()],
            None,
            &[],
            Some(&json!({ "metadata": [{ "key": "title", "value": ["Song"] }] })),
        );
        assert!(data.snapshot.lines.is_empty());
        assert!(data.snapshot.order.is_empty());
        assert_eq!(data.snapshot.project["metadata"][0]["key"], "title");
    }

    #[test]
    fn serves_guest_assets_and_relays_patches_and_chat() {
        tauri::async_runtime::block_on(async {
            let web_dir = std::env::temp_dir().join(format!(
                "ttml-collab-test-{}",
                Uuid::new_v4().simple()
            ));
            fs::create_dir_all(&web_dir).unwrap();
            fs::write(
                web_dir.join("index.html"),
                "<html><body>guest shell</body></html>",
            )
            .unwrap();

            let (tx, _) = broadcast::channel(64);
            let room = Arc::new(Room {
                id: "testroom".to_string(),
                data: Arc::new(Mutex::new(RoomData::default())),
                tx,
                waiting: Mutex::new(Vec::new()),
                host_token: String::new(),
            });
            let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
                .await
                .unwrap();
            let port = listener.local_addr().unwrap().port();
            let server_room = Arc::clone(&room);
            let server_web_dir = web_dir.clone();
            let server = tauri::async_runtime::spawn(async move {
                let _ = axum::serve(listener, build_app(server_room, server_web_dir)).await;
            });

            let http = reqwest::Client::builder().no_proxy().build().unwrap();
            let response = http
                .get(format!("http://127.0.0.1:{port}/some/guest/route"))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
            assert!(response.text().await.unwrap().contains("guest shell"));

            let (mut alex, _) = tokio_tungstenite::connect_async(format!(
                "ws://127.0.0.1:{port}/collab/ws?room=testroom&name=Alex"
            ))
            .await
            .unwrap();
            let welcome = next_message(&mut alex, "welcome").await;
            assert_eq!(welcome["roomId"], "testroom");

            let (mut bob, _) = tokio_tungstenite::connect_async(format!(
                "ws://127.0.0.1:{port}/collab/ws?room=testroom&name=Bob"
            ))
            .await
            .unwrap();
            let _ = next_message(&mut bob, "welcome").await;

            alex.send(WsMessage::Text(
                json!({
                    "type": "patch",
                    "lines": [{ "id": "line-a", "data": { "id": "line-a", "words": [] } }],
                    "removed": [],
                    "order": ["line-a"]
                })
                .to_string()
                .into(),
            ))
            .await
            .unwrap();
            let patch = next_message(&mut bob, "patch").await;
            assert_eq!(patch["lines"][0]["id"], "line-a");
            assert_eq!(patch["order"][0], "line-a");

            alex.send(WsMessage::Text(
                json!({ "type": "lock", "lineIds": ["line-a"] })
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
            let locks = next_message(&mut bob, "locks").await;
            assert_eq!(locks["locks"][0]["lineId"], "line-a");
            assert_eq!(locks["locks"][0]["name"], "Alex");

            alex.send(WsMessage::Text(
                json!({ "type": "lock", "lineIds": [] })
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
            let cleared = next_message(&mut bob, "locks").await;
            assert!(cleared["locks"].as_array().unwrap().is_empty());

            bob.send(WsMessage::Text(
                json!({ "type": "chat", "text": "hello from Bob" })
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
            let chat = next_message(&mut alex, "chat").await;
            assert_eq!(chat["message"]["authorName"], "Bob");
            assert_eq!(chat["message"]["text"], "hello from Bob");

            let order = room.data.lock().unwrap().snapshot.order.clone();
            assert_eq!(order, vec!["line-a"]);

            server.abort();
            let _ = fs::remove_dir_all(&web_dir);
        });
    }

    #[test]
    fn serves_shared_media_only_inside_its_room() {
        tauri::async_runtime::block_on(async {
            let stamp = Uuid::new_v4().simple().to_string();
            let web_dir = std::env::temp_dir().join(format!("ttml-collab-media-web-{stamp}"));
            let media_dir = std::env::temp_dir().join(format!("ttml-collab-media-{stamp}"));
            fs::create_dir_all(&web_dir).unwrap();
            fs::create_dir_all(&media_dir).unwrap();
            fs::write(web_dir.join("index.html"), "<html></html>").unwrap();
            let media_path = media_dir.join("song.mp3");
            fs::write(&media_path, b"shared audio bytes").unwrap();
            let media = SharedMedia {
                id: "media123".to_string(),
                name: "Song.mp3".to_string(),
                kind: "audio".to_string(),
                size: 18,
                added_by: "Host".to_string(),
                at: 1,
            };
            let (tx, _) = broadcast::channel(16);
            let room = Arc::new(Room {
                id: "testroom".to_string(),
                data: Arc::new(Mutex::new(RoomData {
                    media: vec![MediaEntry {
                        meta: media,
                        path: media_path,
                    }],
                    ..Default::default()
                })),
                tx,
                waiting: Mutex::new(Vec::new()),
                host_token: String::new(),
            });
            let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
                .await
                .unwrap();
            let port = listener.local_addr().unwrap().port();
            let server_room = Arc::clone(&room);
            let server_web_dir = web_dir.clone();
            let server = tauri::async_runtime::spawn(async move {
                let _ = axum::serve(listener, build_app(server_room, server_web_dir)).await;
            });
            let http = reqwest::Client::builder().no_proxy().build().unwrap();
            let response = http
                .get(format!(
                    "http://127.0.0.1:{port}/collab/media/media123?room=testroom"
                ))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
            assert!(response
                .headers()
                .get(CONTENT_DISPOSITION)
                .unwrap()
                .to_str()
                .unwrap()
                .contains("Song.mp3"));
            assert_eq!(response.bytes().await.unwrap().as_ref(), b"shared audio bytes");

            let blocked = http
                .get(format!(
                    "http://127.0.0.1:{port}/collab/media/media123?room=wrongroom"
                ))
                .send()
                .await
                .unwrap();
            assert_eq!(blocked.status(), 404);
            server.abort();
            let _ = fs::remove_dir_all(&web_dir);
            let _ = fs::remove_dir_all(&media_dir);
        });
    }

    #[test]
    fn appends_lines_missing_from_the_client_order() {
        let mut data = room_data();
        apply_patch(
            &mut data,
            &[line("b", "two"), line("c", "three")],
            &[],
            Some(&["b".to_string()]),
            &[],
            None,
        );
        assert_eq!(data.snapshot.order, vec!["b", "a", "c"]);
    }

    #[test]
    fn parses_quick_tunnel_urls() {
        assert_eq!(
            find_tunnel_url(
                "2026 INF |  https://returning-merry-compatible-unions.trycloudflare.com  |"
            ),
            Some("https://returning-merry-compatible-unions.trycloudflare.com".to_string())
        );
        assert_eq!(find_tunnel_url("https://api.trycloudflare.com"), None);
        assert_eq!(find_tunnel_url("https://example.com/tunnel"), None);
    }

    #[test]
    fn cloudflared_uses_a_loopback_origin() {
        let args = cloudflared_args(43117);
        assert_eq!(args[args.len() - 1], "http://127.0.0.1:43117");
        assert!(args.iter().any(|arg| arg == "--no-autoupdate"));
        assert!(args.windows(2).any(|pair| pair == ["--protocol", "http2"]));
    }
}
