use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const HISTORY_FILE: &str = "scan_history.json";
const MAX_ENTRIES: usize = 50;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub path: String,
    pub scanned_at: u64,   // Unix timestamp (секунды)
    pub total_bytes: u64,
    pub item_count: u64,
}

fn history_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(HISTORY_FILE))
}

fn load_raw(app: &tauri::AppHandle) -> Vec<HistoryEntry> {
    let Some(path) = history_path(app) else { return vec![] };
    let Ok(data) = fs::read_to_string(&path) else { return vec![] };
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_raw(app: &tauri::AppHandle, entries: &[HistoryEntry]) -> Result<(), String> {
    let path = history_path(app).ok_or("Cannot resolve app data dir")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// Возвращает список истории (новые — первые).
#[tauri::command]
pub fn get_history(app: tauri::AppHandle) -> Vec<HistoryEntry> {
    load_raw(&app)
}

/// Добавляет или обновляет запись в истории для данного пути.
/// Если путь уже есть — обновляет метаданные вместо дублирования.
/// Обрезает список до MAX_ENTRIES.
#[tauri::command]
pub fn add_history_entry(
    app: tauri::AppHandle,
    path: String,
    total_bytes: u64,
    item_count: u64,
) -> Result<(), String> {
    let mut entries = load_raw(&app);

    // Unix timestamp через SystemTime
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Убираем старую запись для этого пути если есть
    entries.retain(|e| e.path != path);

    // Добавляем в начало (новые — первые)
    entries.insert(
        0,
        HistoryEntry {
            path,
            scanned_at: now,
            total_bytes,
            item_count,
        },
    );

    // Обрезаем до лимита
    entries.truncate(MAX_ENTRIES);

    save_raw(&app, &entries)
}

/// Удаляет одну запись из истории по пути.
#[tauri::command]
pub fn remove_history_entry(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut entries = load_raw(&app);
    entries.retain(|e| e.path != path);
    save_raw(&app, &entries)
}

/// Очищает всю историю.
#[tauri::command]
pub fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    save_raw(&app, &[])
}
