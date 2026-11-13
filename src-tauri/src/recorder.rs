use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::downloader::{command, find_tool, spawn_contained, terminate};

struct ActiveRecording {
    child: Child,
    video_path: PathBuf,
    log_path: PathBuf,
    started_at: Instant,
}

#[derive(Default)]
pub struct RecorderState(Mutex<Option<ActiveRecording>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStarted {
    started_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingResult {
    path: String,
    file_name: String,
    size: u64,
    duration_ms: u64,
}

fn recordings_dir() -> PathBuf {
    std::env::temp_dir().join("ttml-editor-recordings")
}

fn stamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn recording_arguments(video_path: &Path) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-y".to_string(),
        "-thread_queue_size".to_string(),
        "1024".to_string(),
    ];

    #[cfg(windows)]
    {
        args.extend(
            [
                "-f",
                "gdigrab",
                "-framerate",
                "30",
                "-draw_mouse",
                "1",
                "-i",
                "desktop",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }
    #[cfg(target_os = "macos")]
    {
        // Device 1 is the primary display in avfoundation's default device list.
        args.extend(
            [
                "-f",
                "avfoundation",
                "-framerate",
                "30",
                "-capture_cursor",
                "1",
                "-i",
                "1",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        args.extend(
            ["-f", "x11grab", "-framerate", "30", "-i", ":0.0"]
                .into_iter()
                .map(str::to_string),
        );
    }

    args.extend(
        [
            "-vf",
            "fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "27",
            "-maxrate",
            "8M",
            "-bufsize",
            "16M",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "30",
            "-movflags",
            "+faststart",
        ]
        .into_iter()
        .map(str::to_string),
    );
    args.push(video_path.to_string_lossy().into_owned());
    args
}

#[tauri::command]
pub fn start_screen_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingStarted, String> {
    let mut active = state
        .0
        .lock()
        .map_err(|_| "Screen recorder state is unavailable.".to_string())?;
    if active.is_some() {
        return Err("A screen recording is already running.".to_string());
    }

    let ffmpeg = find_tool(&app, "ffmpeg").ok_or_else(|| {
        "Screen recording needs the bundled FFmpeg, but it was not found. Reinstall the app or add ffmpeg to PATH.".to_string()
    })?;
    let dir = recordings_dir();
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create the recording folder: {error}"))?;
    let recording_started = Instant::now();
    let started_at = stamp();
    let timestamp = stamp();
    let video_path = dir.join(format!("recording-{timestamp}.mp4"));
    let log_path = dir.join(format!("recording-{timestamp}.log"));
    let log = fs::File::create(&log_path)
        .map_err(|error| format!("Could not prepare the recorder log: {error}"))?;

    let mut child = spawn_contained(
        command(ffmpeg)
            .args(recording_arguments(&video_path))
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::from(log)),
    )
    .map_err(|error| format!("Could not start screen recording: {error}"))?;

    // FFmpeg can fail immediately (for example when no desktop capture device
    // is available). Give it a moment so the UI does not report a recording
    // that is already dead.
    std::thread::sleep(Duration::from_millis(350));
    if let Ok(Some(status)) = child.try_wait() {
        let detail = fs::read_to_string(&log_path).unwrap_or_default();
        let _ = fs::remove_file(&video_path);
        let _ = fs::remove_file(&log_path);
        let detail = detail.trim();
        return Err(if detail.is_empty() {
            format!("FFmpeg stopped before recording began ({status}).")
        } else {
            format!("Screen recording could not start: {detail}")
        });
    }

    *active = Some(ActiveRecording {
        child,
        video_path,
        log_path,
        started_at: recording_started,
    });
    Ok(RecordingStarted {
        started_at: started_at as u64,
    })
}

fn stop_ffmpeg(child: &mut Child) {
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(b"q\n");
        let _ = stdin.flush();
    }
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => break,
        }
    }
    terminate(child);
}

fn finish_recording(
    active: ActiveRecording,
    audio_path: Option<String>,
    audio_offset_ms: Option<u64>,
    ffmpeg: PathBuf,
) -> Result<RecordingResult, String> {
    let ActiveRecording {
        mut child,
        video_path,
        log_path,
        started_at,
    } = active;
    stop_ffmpeg(&mut child);

    let video_size = fs::metadata(&video_path).map(|m| m.len()).unwrap_or(0);
    if video_size == 0 {
        let detail = fs::read_to_string(&log_path).unwrap_or_default();
        let _ = fs::remove_file(&video_path);
        let _ = fs::remove_file(&log_path);
        return Err(if detail.trim().is_empty() {
            "The screen recording did not produce a video.".to_string()
        } else {
            format!("The screen recording failed: {}", detail.trim())
        });
    }

    let output_path = recordings_dir().join(format!(
        "TTML Recording {}.mp4",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    ));
    let mut has_audio = false;

    if let Some(audio_path) = audio_path {
        let audio = PathBuf::from(audio_path);
        let valid_audio = audio.is_file()
            && fs::metadata(&audio).map(|m| m.len() > 0).unwrap_or(false)
            && audio.starts_with(std::env::temp_dir())
            && audio
                .file_name()
                .map(|name| {
                    name.to_string_lossy()
                        .starts_with("ttml-recording-audio-")
                })
                .unwrap_or(false);
        if valid_audio {
            let video_arg = video_path.to_string_lossy().into_owned();
            let audio_arg = audio.to_string_lossy().into_owned();
            let mut mux_args: Vec<String> = [
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                &video_arg,
                "-i",
                &audio_arg,
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-shortest",
                "-movflags",
                "+faststart",
            ]
            .into_iter()
            .map(str::to_string)
            .collect();
            if let Some(offset) = audio_offset_ms.filter(|offset| *offset > 0 && *offset <= 15_000) {
                mux_args.push("-af".to_string());
                mux_args.push(format!("adelay={offset}:all=1"));
            }
            mux_args.push(output_path.to_string_lossy().into_owned());
            let output = command(ffmpeg).args(&mux_args).output();
            has_audio = output
                .map(|result| result.status.success() && output_path.is_file())
                .unwrap_or(false);
            let _ = fs::remove_file(&audio);
        }
    }

    if has_audio {
        let _ = fs::remove_file(&video_path);
    } else {
        let _ = fs::remove_file(&output_path);
        fs::rename(&video_path, &output_path)
            .map_err(|error| format!("Could not finish the recording: {error}"))?;
    }
    let _ = fs::remove_file(&log_path);

    let size = fs::metadata(&output_path)
        .map_err(|error| format!("Could not read the finished recording: {error}"))?
        .len();
    let file_name = output_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "TTML Recording.mp4".to_string());
    Ok(RecordingResult {
        path: output_path.to_string_lossy().into_owned(),
        file_name,
        size,
        duration_ms: started_at.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn stop_screen_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    audio_path: Option<String>,
    audio_offset_ms: Option<u64>,
) -> Result<RecordingResult, String> {
    let active = state
        .0
        .lock()
        .map_err(|_| "Screen recorder state is unavailable.".to_string())?
        .take()
        .ok_or_else(|| "No screen recording is running.".to_string())?;
    let ffmpeg = find_tool(&app, "ffmpeg")
        .ok_or_else(|| "The bundled FFmpeg was not found.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        finish_recording(active, audio_path, audio_offset_ms, ffmpeg)
    })
        .await
        .map_err(|error| format!("The recorder stopped unexpectedly: {error}"))?
}

#[tauri::command]
pub fn save_screen_recording(source_path: String, destination_path: String) -> Result<(), String> {
    let dir = recordings_dir()
        .canonicalize()
        .map_err(|error| format!("The recording folder is unavailable: {error}"))?;
    let source = PathBuf::from(&source_path)
        .canonicalize()
        .map_err(|error| format!("The recording is no longer available: {error}"))?;
    if !source.starts_with(&dir) || !source.is_file() {
        return Err("That file is not an editable recording.".to_string());
    }
    let destination = PathBuf::from(destination_path);
    if destination.as_os_str().is_empty() {
        return Err("Choose where to save the recording.".to_string());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create the destination folder: {error}"))?;
    }
    fs::copy(&source, &destination)
        .map_err(|error| format!("Could not save the recording: {error}"))?;
    Ok(())
}

pub(crate) fn shutdown(state: &RecorderState) {
    if let Ok(mut active) = state.0.lock() {
        if let Some(mut recording) = active.take() {
            terminate(&mut recording.child);
            let _ = fs::remove_file(recording.video_path);
            let _ = fs::remove_file(recording.log_path);
        }
    }
}
