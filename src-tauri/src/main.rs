// Tauri v2 entrypoint
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    orbita_lib::run();
}
