mod export;
mod history;
mod scan;

use scan::ScanState;
use serde::Serialize;
use sysinfo::Disks;

// ─── Структуры ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskInfo {
    name: String,
    s_mount_point: String,
    total_space: u64,
    available_space: u64,
    is_removable: bool,
}

// ─── Команды Tauri ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_disks() -> Result<Vec<DiskInfo>, String> {
    let disks = Disks::new_with_refreshed_list();
    let vec: Vec<DiskInfo> = disks
        .list()
        .iter()
        // Фильтруем виртуальные точки монтирования (totalSpace == 0)
        .filter(|disk| disk.total_space() > 0)
        .map(|disk| DiskInfo {
            name: disk.name().to_str().unwrap_or("").to_string(),
            s_mount_point: disk.mount_point().display().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            is_removable: disk.is_removable(),
        })
        .collect();
    Ok(vec)
}

#[tauri::command]
fn start_scanning(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, ScanState>,
    path: String,
    ratio: String,
) -> Result<(), String> {
    scan::start(app_handle, state, path, ratio)
}

#[tauri::command]
fn stop_scanning(state: tauri::State<'_, ScanState>) -> Result<(), String> {
    scan::stop(state);
    Ok(())
}

#[tauri::command]
fn show_in_folder(path: String) {

    #[cfg(target_os = "windows")]
    {
        let normalized = path.replace('/', "\\");
        std::process::Command::new("explorer")
            .args(["/select,", &normalized])
            .spawn()
            .ok();
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .ok();
    }

    #[cfg(target_os = "linux")]
    {
        use std::path::Path;
        let p = Path::new(&path);
        let target = if p.is_dir() {
            path.clone()
        } else {
            p.parent()
                .and_then(|pp| pp.to_str())
                .unwrap_or(&path)
                .to_string()
        };
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .ok();
    }
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    use std::path::PathBuf;

    let p = PathBuf::from(&path);

    if !p.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    let canonical = p
        .canonicalize()
        .map_err(|e| format!("Cannot resolve path: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        let forbidden: &[&str] = &[
            "C:\\",
            "C:\\Windows",
            "C:\\Program Files",
            "C:\\Program Files (x86)",
            "C:\\Users",
        ];
        let canonical_str = canonical.to_str().unwrap_or("");
        if forbidden
            .iter()
            .any(|f| canonical_str.eq_ignore_ascii_case(f))
        {
            return Err("Refusing to delete system directory".to_string());
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let forbidden = [
            "/", "/home", "/usr", "/etc", "/bin", "/sbin", "/lib", "/var", "/tmp", "/root",
        ];
        let canonical_str = canonical.to_str().unwrap_or("");
        if forbidden.contains(&canonical_str) {
            return Err("Refusing to delete system directory".to_string());
        }
    }

    trash::delete(&canonical).map_err(|e| format!("Failed to move to trash: {}", e))
}

// ─── Точка запуска ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ScanState(Default::default()))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // диски
            get_disks,
            // сканирование
            start_scanning,
            stop_scanning,
            // файловые операции
            show_in_folder,
            delete_path,
            // история
            history::get_history,
            history::add_history_entry,
            history::remove_history_entry,
            history::clear_history,
            // экспорт
            export::export_csv,
            export::export_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}