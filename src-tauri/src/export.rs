use serde::Deserialize;
use serde_json::Value;
use std::fs;

/// Узел дерева, пришедший с фронта для экспорта
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportNode {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_directory: bool,
    #[serde(default)]
    pub children: Vec<ExportNode>,
}

/// Рекурсивно собирает плоский CSV из дерева.
/// Каждая строка: path, name, type, size_bytes, size_human
fn flatten_to_csv_rows(node: &ExportNode, rows: &mut Vec<String>) {
    let kind = if node.is_directory { "directory" } else { "file" };
    let human = format_bytes(node.size_bytes);

    // FIX #11: экранируем кавычки и оборачиваем в кавычки и path, и name —
    // имена файлов тоже могут содержать запятые.
    let escaped_path = node.path.replace('"', "\"\"");
    let escaped_name = node.name.replace('"', "\"\"");

    rows.push(format!(
        "\"{}\",\"{}\",{},{},\"{}\"",
        escaped_path, escaped_name, kind, node.size_bytes, human
    ));
    for child in &node.children {
        flatten_to_csv_rows(child, rows);
    }
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1_000;
    const MB: u64 = 1_000 * KB;
    const GB: u64 = 1_000 * MB;
    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Экспортирует дерево в CSV файл по указанному пути.
#[tauri::command]
pub fn export_csv(tree_json: String, dest_path: String) -> Result<(), String> {
    let node: ExportNode =
        serde_json::from_str(&tree_json).map_err(|e| format!("Parse error: {}", e))?;

    // FIX #11: добавлена колонка name
    let mut rows = vec!["path,name,type,size_bytes,size_human".to_string()];
    flatten_to_csv_rows(&node, &mut rows);

    let csv = rows.join("\n");
    fs::write(&dest_path, csv).map_err(|e| format!("Write error: {}", e))
}

/// Экспортирует дерево в JSON файл по указанному пути (pretty-printed).
#[tauri::command]
pub fn export_json(tree_json: String, dest_path: String) -> Result<(), String> {
    let value: Value =
        serde_json::from_str(&tree_json).map_err(|e| format!("Parse error: {}", e))?;
    let pretty = serde_json::to_string_pretty(&value).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&dest_path, pretty).map_err(|e| format!("Write error: {}", e))
}