//! Downloader tool management: locating yt-dlp, FFmpeg, FFprobe and Deno,
//! checking yt-dlp's official GitHub releases, and installing verified updates
//! into the app's fixed AppData folder.
//!
//! Nothing here runs a downloaded binary before its SHA-256 has been checked
//! and its `--version` (or `-version`) command has succeeded.

use crate::downloader::{
    DownloadError, app_tool_dir, bundled_dirs, command, custom_tool_path, error, find_tool,
};
use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

const USER_AGENT: &str = "TTML-Tool-downloader/1.0";
const YTDLP_LATEST_API: &str = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const MAX_DOWNLOAD_BYTES: usize = 220 * 1024 * 1024;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub name: String,
    pub path: Option<String>,
    pub version: Option<String>,
    /// `custom`, `appData`, `bundled`, `system`, or `missing`.
    pub source: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloaderInfo {
    pub yt_dlp: ToolStatus,
    pub ffmpeg: ToolStatus,
    pub ffprobe: ToolStatus,
    pub js_runtime: ToolStatus,
    pub platform: String,
    pub arch: String,
    pub app_tool_dir: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
    pub asset_name: String,
    pub asset_url: String,
    pub size: u64,
    pub sha256: Option<String>,
    pub release_url: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub ok: bool,
    pub output: String,
}

#[derive(serde::Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(serde::Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

fn fail(code: &'static str, detail: impl ToString) -> DownloadError {
    error(code, detail)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn run_version(path: &Path, arg: &str) -> Option<String> {
    let output = command(path)
        .arg(arg)
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            String::from_utf8_lossy(&output.stderr)
                .lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .map(str::to_owned)
        })
}

fn version_argument(name: &str) -> &'static str {
    if name == "ffmpeg" || name == "ffprobe" {
        "-version"
    } else {
        "--version"
    }
}

fn source_for(app: &tauri::AppHandle, name: &str, path: &Path) -> String {
    if custom_tool_path(app, name).as_deref() == Some(path) {
        return "custom".into();
    }
    if app_tool_dir(app).is_some_and(|dir| path.starts_with(dir)) {
        return "appData".into();
    }
    if bundled_dirs(app).iter().any(|dir| path.starts_with(dir)) {
        return "bundled".into();
    }
    "system".into()
}

fn status_for(app: &tauri::AppHandle, name: &str) -> ToolStatus {
    match find_tool(app, name) {
        Some(path) => ToolStatus {
            name: name.into(),
            version: run_version(&path, version_argument(name)),
            source: source_for(app, name, &path),
            path: Some(path.to_string_lossy().into_owned()),
        },
        None => ToolStatus {
            name: name.into(),
            path: None,
            version: None,
            source: "missing".into(),
        },
    }
}

fn find_js_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Some(custom) = custom_tool_path(app, "deno") {
        if custom.is_file() {
            return Some(custom);
        }
    }
    if let Some(dir) = app_tool_dir(app) {
        let candidate = dir.join(format!("deno{}", std::env::consts::EXE_SUFFIX));
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    for dir in bundled_dirs(app) {
        let candidate = dir.join(format!("deno{}", std::env::consts::EXE_SUFFIX));
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    crate::downloader::find_system_binary("deno")
}

fn info(app: &tauri::AppHandle) -> DownloaderInfo {
    let js_runtime = match find_js_runtime(app) {
        Some(path) => ToolStatus {
            name: "deno".into(),
            version: run_version(&path, "--version"),
            source: source_for(app, "deno", &path),
            path: Some(path.to_string_lossy().into_owned()),
        },
        None => ToolStatus {
            name: "deno".into(),
            path: None,
            version: None,
            source: "missing".into(),
        },
    };
    DownloaderInfo {
        yt_dlp: status_for(app, "yt-dlp"),
        ffmpeg: status_for(app, "ffmpeg"),
        ffprobe: status_for(app, "ffprobe"),
        js_runtime,
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        app_tool_dir: app_tool_dir(app)
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_default(),
    }
}

#[tauri::command]
pub fn downloader_info(app: tauri::AppHandle) -> DownloaderInfo {
    info(&app)
}

fn ensure_tool_dir(app: &tauri::AppHandle) -> Result<PathBuf, DownloadError> {
    let dir = app_tool_dir(app)
        .ok_or_else(|| fail("failed", "The app data folder is unavailable."))?;
    fs::create_dir_all(&dir).map_err(|cause| fail("failed", cause))?;
    Ok(dir)
}

fn chmod_executable(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(path) {
            let mut permissions = metadata.permissions();
            permissions.set_mode(permissions.mode() | 0o755);
            let _ = fs::set_permissions(path, permissions);
        }
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}

fn version_parts(value: &str) -> Vec<u64> {
    value
        .trim_start_matches('v')
        .split(|character: char| !character.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u64>().ok())
        .collect()
}

fn is_newer(latest: &str, current: &str) -> bool {
    if current.is_empty() || current == "missing" {
        return true;
    }
    version_parts(latest) > version_parts(current)
}

fn platform_asset_name() -> Result<&'static str, DownloadError> {
    if cfg!(target_os = "windows") {
        return Ok("yt-dlp.exe");
    }
    if cfg!(target_os = "macos") {
        return Ok("yt-dlp_macos");
    }
    if cfg!(target_os = "linux") {
        return match std::env::consts::ARCH {
            "x86_64" => Ok("yt-dlp_linux"),
            "aarch64" => Ok("yt-dlp_linux_aarch64"),
            other => Err(fail(
                "unsupportedPlatform",
                format!("No official yt-dlp build for Linux {other}."),
            )),
        };
    }
    Err(fail(
        "unsupportedPlatform",
        format!("No official yt-dlp build for {}.", std::env::consts::OS),
    ))
}

async fn fetch_release(client: &reqwest::Client) -> Result<GitHubRelease, DownloadError> {
    let response = client
        .get(YTDLP_LATEST_API)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .timeout(Duration::from_secs(25))
        .send()
        .await
        .map_err(|cause| fail("network", cause))?;
    if !response.status().is_success() {
        return Err(fail(
            "network",
            format!("GitHub returned HTTP {}.", response.status()),
        ));
    }
    response
        .json::<GitHubRelease>()
        .await
        .map_err(|cause| fail("network", cause))
}

fn asset_named<'a>(release: &'a GitHubRelease, name: &str) -> Option<&'a GitHubAsset> {
    release.assets.iter().find(|asset| asset.name == name)
}

async fn checksum_from_sums(
    client: &reqwest::Client,
    release: &GitHubRelease,
    asset_name: &str,
) -> Result<String, DownloadError> {
    let sums = asset_named(release, "SHA2-256SUMS")
        .ok_or_else(|| fail("unverified", "This release has no checksum file."))?;
    let text = client
        .get(&sums.browser_download_url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .timeout(Duration::from_secs(25))
        .send()
        .await
        .map_err(|cause| fail("network", cause))?
        .error_for_status()
        .map_err(|cause| fail("network", cause))?
        .text()
        .await
        .map_err(|cause| fail("network", cause))?;
    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let Some(hash) = parts.next() else { continue };
        let file = parts.next().unwrap_or("").trim_start_matches('*');
        if file == asset_name && hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Ok(hash.to_ascii_lowercase());
        }
    }
    Err(fail(
        "unverified",
        format!("No checksum was published for {asset_name}."),
    ))
}

async fn resolve_digest(
    client: &reqwest::Client,
    release: &GitHubRelease,
    asset: &GitHubAsset,
) -> Result<String, DownloadError> {
    if let Some(digest) = asset.digest.as_deref() {
        if let Some(hash) = digest.strip_prefix("sha256:") {
            if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
                return Ok(hash.to_ascii_lowercase());
            }
        }
    }
    checksum_from_sums(client, release, &asset.name).await
}

fn current_version(app: &tauri::AppHandle) -> String {
    find_tool(app, "yt-dlp")
        .and_then(|path| run_version(&path, "--version"))
        .unwrap_or_else(|| "missing".into())
}

#[tauri::command]
pub async fn check_ytdlp_update(app: tauri::AppHandle) -> Result<UpdateCheck, DownloadError> {
    let asset_name = platform_asset_name()?;
    let client = reqwest::Client::new();
    let release = fetch_release(&client).await?;
    let asset = asset_named(&release, asset_name)
        .ok_or_else(|| fail("unverified", format!("{asset_name} is missing from the release.")))?;
    let current = current_version(&app);
    let sha256 = resolve_digest(&client, &release, asset).await.ok();
    let latest = release.tag_name.clone();
    let asset_name = asset.name.clone();
    let asset_url = asset.browser_download_url.clone();
    let size = asset.size;
    let release_url = release.html_url.clone();
    Ok(UpdateCheck {
        update_available: is_newer(&latest, &current),
        current,
        latest,
        asset_name,
        asset_url,
        size,
        sha256,
        release_url,
    })
}

async fn download_verified(
    client: &reqwest::Client,
    url: &str,
    expected: &str,
) -> Result<Vec<u8>, DownloadError> {
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|cause| fail("network", cause))?;
    if !response.status().is_success() {
        return Err(fail(
            "network",
            format!("The download returned HTTP {}.", response.status()),
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_DOWNLOAD_BYTES as u64)
    {
        return Err(fail("failed", "The download is unexpectedly large."));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|cause| fail("network", cause))?;
    if bytes.len() > MAX_DOWNLOAD_BYTES {
        return Err(fail("failed", "The download is unexpectedly large."));
    }
    let actual = sha256_hex(&bytes);
    if actual != expected.to_ascii_lowercase() {
        return Err(fail(
            "unverified",
            format!("Checksum mismatch. Expected {expected}, received {actual}."),
        ));
    }
    Ok(bytes.to_vec())
}

fn install_binary(
    app: &tauri::AppHandle,
    name: &str,
    bytes: &[u8],
    version_arg: &str,
) -> Result<ToolStatus, DownloadError> {
    let dir = ensure_tool_dir(app)?;
    let suffix = std::env::consts::EXE_SUFFIX;
    let test_path = dir.join(format!("{name}.test{suffix}"));
    let final_path = dir.join(format!("{name}{suffix}"));
    fs::write(&test_path, bytes).map_err(|cause| fail("failed", cause))?;
    chmod_executable(&test_path);
    let version = run_version(&test_path, version_arg).ok_or_else(|| {
        let _ = fs::remove_file(&test_path);
        fail("failed", format!("The downloaded {name} did not run."))
    })?;
    if final_path.is_file() {
        let backup = dir.join(format!("{name}.previous{suffix}"));
        let _ = fs::remove_file(&backup);
        fs::copy(&final_path, &backup).map_err(|cause| fail("failed", cause))?;
        fs::remove_file(&final_path).map_err(|cause| fail("failed", cause))?;
    }
    fs::rename(&test_path, &final_path).map_err(|cause| fail("failed", cause))?;
    chmod_executable(&final_path);
    Ok(ToolStatus {
        name: name.into(),
        path: Some(final_path.to_string_lossy().into_owned()),
        version: Some(version),
        source: "appData".into(),
    })
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<ToolStatus, DownloadError> {
    let asset_name = platform_asset_name()?;
    let client = reqwest::Client::new();
    let release = fetch_release(&client).await?;
    let asset = asset_named(&release, asset_name)
        .ok_or_else(|| fail("unverified", format!("{asset_name} is missing from the release.")))?;
    let expected = resolve_digest(&client, &release, asset).await?;
    let bytes = download_verified(&client, &asset.browser_download_url, &expected).await?;
    let installed = install_binary(&app, "yt-dlp", &bytes, "--version")?;
    Ok(installed)
}

struct StaticBinary {
    name: &'static str,
    url: String,
    sha256: &'static str,
}

fn ffmpeg_static_binaries() -> Result<[StaticBinary; 2], DownloadError> {
    let base = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1";
    let target = if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
        "win32-x64"
    } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        "darwin-arm64"
    } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
        "darwin-x64"
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
        "linux-x64"
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
        "linux-arm64"
    } else {
        return Err(fail(
            "unsupportedPlatform",
            format!(
                "No verified FFmpeg repair build for {} {}.",
                std::env::consts::OS,
                std::env::consts::ARCH
            ),
        ));
    };
    let (ffmpeg_hash, ffprobe_hash) = match target {
        "win32-x64" => (
            "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77",
            "f309e6223ad89d2fe54bccd420a7709b66fd27540674e92309578ed491a43c8d",
        ),
        "darwin-arm64" => (
            "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa",
            "d986a8ec7b030899fe66a8a288ed809a3543338705a3ce178cfb85869c5d80be",
        ),
        "darwin-x64" => (
            "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106",
            "d4da574d6e2e197bd259b47d69cf262df9e312af24ad960444f6d806d3d4c186",
        ),
        "linux-x64" => (
            "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa",
            "25d9b6ccb05e3d9de9e04e31e2506d8dd7f9f0418981965ac6df12e8d3afd067",
        ),
        "linux-arm64" => (
            "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0",
            "2ab6aba60ee84412dff9188720703376cb4e7aaf7e0b5e43aa8249f2acae5bf8",
        ),
        _ => unreachable!(),
    };
    Ok([
        StaticBinary {
            name: "ffmpeg",
            url: format!("{base}/ffmpeg-{target}.gz"),
            sha256: ffmpeg_hash,
        },
        StaticBinary {
            name: "ffprobe",
            url: format!("{base}/ffprobe-{target}.gz"),
            sha256: ffprobe_hash,
        },
    ])
}

fn gunzip(bytes: &[u8]) -> Result<Vec<u8>, DownloadError> {
    let mut decoder = GzDecoder::new(bytes);
    let mut output = Vec::new();
    decoder
        .read_to_end(&mut output)
        .map_err(|cause| fail("failed", cause))?;
    Ok(output)
}

#[tauri::command]
pub async fn download_ffmpeg(app: tauri::AppHandle) -> Result<ToolStatus, DownloadError> {
    let binaries = ffmpeg_static_binaries()?;
    let client = reqwest::Client::new();
    let mut ffmpeg_status = None;
    for binary in binaries {
        let compressed = download_verified(&client, &binary.url, binary.sha256).await?;
        let bytes = gunzip(&compressed)?;
        let status = install_binary(&app, binary.name, &bytes, "-version")?;
        if binary.name == "ffmpeg" {
            ffmpeg_status = Some(status);
        }
    }
    ffmpeg_status.ok_or_else(|| fail("failed", "FFmpeg was not installed."))
}

#[tauri::command]
pub fn test_downloader(app: tauri::AppHandle) -> TestResult {
    let info = info(&app);
    let mut lines = vec![
        format!("Platform: {} {}", info.platform, info.arch),
        format!("yt-dlp: {} ({})", describe(&info.yt_dlp), info.yt_dlp.source),
        format!("FFmpeg: {} ({})", describe(&info.ffmpeg), info.ffmpeg.source),
        format!("FFprobe: {} ({})", describe(&info.ffprobe), info.ffprobe.source),
        format!("Deno: {} ({})", describe(&info.js_runtime), info.js_runtime.source),
    ];
    if let Some(path) = info.yt_dlp.path.as_deref() {
        if let Ok(output) = command(path).arg("--version").output() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if !text.is_empty() {
                lines.push(format!("yt-dlp output: {text}"));
            }
        }
    }
    TestResult {
        ok: info.yt_dlp.version.is_some() && info.ffmpeg.version.is_some(),
        output: lines.join("\n"),
    }
}

fn describe(status: &ToolStatus) -> String {
    status
        .version
        .clone()
        .unwrap_or_else(|| "not found".into())
}

fn read_custom_paths(app: &tauri::AppHandle) -> serde_json::Map<String, serde_json::Value> {
    let Some(dir) = app_tool_dir(app) else {
        return serde_json::Map::new();
    };
    let Ok(text) = fs::read_to_string(dir.join("tools.json")) else {
        return serde_json::Map::new();
    };
    serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&text).unwrap_or_default()
}

fn validate_tool(path: &str, name: &str) -> Result<PathBuf, DownloadError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(fail("invalidTool", "Choose a file first."));
    }
    let candidate = PathBuf::from(trimmed);
    if !candidate.is_file() {
        return Err(fail("invalidTool", "That file does not exist."));
    }
    if run_version(&candidate, version_argument(name)).is_none() {
        return Err(fail(
            "invalidTool",
            format!("That file did not respond like {name}."),
        ));
    }
    Ok(candidate)
}

#[tauri::command]
pub fn set_tool_paths(
    app: tauri::AppHandle,
    yt_dlp: Option<String>,
    ffmpeg: Option<String>,
) -> Result<DownloaderInfo, DownloadError> {
    let mut paths = read_custom_paths(&app);
    if let Some(value) = yt_dlp {
        if value.trim().is_empty() {
            paths.remove("ytDlp");
        } else {
            let path = validate_tool(&value, "yt-dlp")?;
            paths.insert("ytDlp".into(), path.to_string_lossy().into_owned().into());
        }
    }
    if let Some(value) = ffmpeg {
        if value.trim().is_empty() {
            paths.remove("ffmpeg");
        } else {
            let path = validate_tool(&value, "ffmpeg")?;
            paths.insert("ffmpeg".into(), path.to_string_lossy().into_owned().into());
        }
    }
    let dir = ensure_tool_dir(&app)?;
    let text = serde_json::to_string_pretty(&paths).map_err(|cause| fail("failed", cause))?;
    let temporary = dir.join("tools.json.tmp");
    fs::write(&temporary, text).map_err(|cause| fail("failed", cause))?;
    fs::rename(&temporary, dir.join("tools.json")).map_err(|cause| fail("failed", cause))?;
    Ok(info(&app))
}
