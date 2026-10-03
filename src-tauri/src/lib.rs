/// Pasta onde está o executável do app. Os sidecars (yt-dlp, ffmpeg, ffprobe, deno)
/// são copiados para cá na instalação, e o yt-dlp recebe isso em --ffmpeg-location.
#[tauri::command]
fn bin_dir() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe
        .parent()
        .ok_or_else(|| "executável sem pasta".to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![bin_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
