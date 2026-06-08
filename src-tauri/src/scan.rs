use std::fs;
use std::sync::{Mutex, OnceLock};

use regex::Regex;

use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Clone, serde::Serialize)]
pub struct ScanStatus {
    pub items: u64,
    pub total: u64,
    pub errors: u64,
}

pub struct ScanState(pub Mutex<Option<CommandChild>>);

// FIX: Regex компилируется ровно один раз за время жизни программы (OnceLock).
// Раньше функция progress_regex() пересоздавала Regex при каждом вызове start().
static PROGRESS_RE: OnceLock<Regex> = OnceLock::new();

fn progress_regex() -> &'static Regex {
    PROGRESS_RE.get_or_init(|| {
        Regex::new(r"\(scanned ([0-9]+), total ([0-9]+)(?:, erred ([0-9]+))?\)").unwrap()
    })
}

/// Запускает сканирование через sidecar pdu.
/// Если предыдущее сканирование ещё идёт — убивает его перед запуском нового.
pub fn start(
    app_handle: AppHandle,
    state: tauri::State<'_, ScanState>,
    path: String,
    ratio: String,
) -> Result<(), String> {
    // ── 1. Убиваем старый процесс если есть ────────────────────────────────
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(old_child) = guard.take() {
            old_child.kill().ok();
        }
    }

    // ── 2. Валидация пути ────────────────────────────────────────────────────
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    // ── 3. Сборка аргументов ─────────────────────────────────────────────────
    let ratio_f: f64 = ratio.parse::<f64>().unwrap_or(0.001).clamp(0.0, 1.0);
    let ratio_arg = format!("--min-ratio={:.4}", ratio_f);

    let mut args: Vec<String> = vec![
        "--json-output".to_string(),
        "--progress".to_string(),
        ratio_arg,
    ];

    // Если корень — сканируем отдельные подпапки, пропуская системные
    if path == "/" {
        let banned = [
            "/dev", "/mnt", "/cdrom", "/proc", "/media", "/Volumes", "/System", "/run", "/sys",
        ];
        match fs::read_dir("/") {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if let Some(p_str) = p.to_str() {
                        if !banned.contains(&p_str) {
                            args.push(p_str.to_string());
                        }
                    }
                }
            }
            Err(e) => {
                return Err(format!("Cannot read root directory: {}", e));
            }
        }
    } else {
        args.push(path.clone());
    }

    // ── 4. Запуск sidecar ────────────────────────────────────────────────────
    let (mut rx, child) = app_handle
        .shell()
        .sidecar("pdu")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn pdu: {}", e))?;

    // Сохраняем child под мьютексом
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let re = progress_regex();

    // ── 5. Асинхронное чтение stdout / stderr ────────────────────────────────
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line).to_string();
                    #[cfg(debug_assertions)]
                    {
                        let preview_len = line_str.len().min(200);
                        eprintln!("PDU stdout: {}", &line_str[..preview_len]);
                    }
                    app_handle.emit("scan_completed", line_str).ok();
                }

                CommandEvent::Stderr(msg) => {
                    let msg_str = String::from_utf8_lossy(&msg).to_string();
                    if let Some(caps) = re.captures(&msg_str) {
                        let parse = |idx: usize| -> u64 {
                            caps.get(idx)
                                .map(|m| m.as_str())
                                .unwrap_or("0")
                                .trim()
                                .parse::<u64>()
                                .unwrap_or(0)
                        };
                        app_handle
                            .emit(
                                "scan_status",
                                ScanStatus {
                                    items: parse(1),
                                    total: parse(2),
                                    errors: parse(3),
                                },
                            )
                            .ok();
                    }
                }

                CommandEvent::Terminated(status) => {
                    #[cfg(debug_assertions)]
                    eprintln!("pdu terminated: {:?}", status);
                    app_handle.emit("scan_terminated", status.code).ok();
                }

                _ => {}
            }
        }
    });

    Ok(())
}

/// Останавливает текущее сканирование (kill pdu процесса).
pub fn stop(state: tauri::State<'_, ScanState>) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(child) = guard.take() {
            child.kill().ok();
        }
    }
}