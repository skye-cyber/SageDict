use crate::paths;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
// use tauri_plugin_fs::FsExt;

// ---------- Config API ---------------------------------------------------
fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .subsec_nanos();
    format!("{:x}{:x}", nanos, std::process::id())
}

// ---------- FS API -------------------------------------------------------

#[tauri::command]
pub fn fs_mkdir(dir: String) -> Result<bool, String> {
    fs::create_dir_all(&dir)
    .map(|_| true)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_read_dir(dir: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    Ok(entries
    .filter_map(|e| e.ok())
    .map(|e| e.file_name().to_string_lossy().to_string())
    .collect())
}

#[tauri::command]
pub fn fs_write(file_path: String, data: String) -> Result<bool, String> {
    fs::write(&file_path, data)
    .map(|_| true)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_read(file_path: String) -> Result<Value, String> {
    let raw = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_delete(file_path: String) -> Result<bool, String> {
    if Path::new(&file_path).exists() {
        fs::remove_file(&file_path)
        .map(|_| true)
        .map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn fs_exists(file_path: String) -> bool {
    Path::new(&file_path).exists()
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<bool, String> {
    fs::rename(&old_path, &new_path)
    .map(|_| true)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_stat_size(file_path: String) -> Result<u64, String> {
    fs::metadata(&file_path)
    .map(|m| m.len())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_trash(file_path: String) -> Result<bool, String> {
    let p = PathBuf::from(&file_path);
    if !p.exists() {
        return Ok(false);
    }
    let trash = trash_dir();
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;

    let name = p
    .file_name()
    .unwrap_or_default()
    .to_string_lossy()
    .to_string();
    let mut target = trash.join(&name);
    let mut i = 1;
    while target.exists() {
        let stem = p.file_stem().unwrap_or_default().to_string_lossy();
        let ext = p
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
        target = trash.join(format!("{} ({}){}", stem, i, ext));
        i += 1;
    }
    fs::rename(&p, &target)
    .map(|_| true)
    .map_err(|e| e.to_string())
}

fn trash_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().unwrap_or_default().join(".Trash")
    }
    #[cfg(target_os = "linux")]
    {
        dirs::home_dir()
        .unwrap_or_default()
        .join(".local/share/Trash/files")
    }
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir()
        .unwrap_or_default()
        .join("Microsoft/Windows/Recycle Bin")
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        dirs::home_dir().unwrap_or_default().join(".trash")
    }
}

#[tauri::command]
pub fn fs_homedir() -> String {
    dirs::home_dir()
    .unwrap_or_default()
    .to_string_lossy()
    .to_string()
}

#[tauri::command]
pub fn fs_downloads() -> String {
    dirs::download_dir()
    .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
    .unwrap_or_default()
    .to_string_lossy()
    .to_string()
}

#[tauri::command]
pub fn fs_temp() -> String {
    std::env::temp_dir().to_string_lossy().to_string()
}

// ---------- System -------------------------------------------------------

#[tauri::command]
pub fn system_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn system_total_mem() -> u64 {
    0
}

#[tauri::command]
pub fn system_format_date(iso: String) -> String {
    iso
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_secs();
    format!("{}", secs)
}
