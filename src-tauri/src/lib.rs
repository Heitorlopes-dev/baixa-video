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

/// Encerra o yt-dlp e os processos que ele abriu (ffmpeg, ffprobe, deno).
/// O kill do plugin shell só alcança o yt-dlp, e o ffmpeg continuaria escrevendo na pasta.
#[tauri::command]
fn kill_tree(pid: u32) -> Result<(), String> {
    let pid = pid.to_string();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("taskkill")
            .args(["/PID", &pid, "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("pkill")
            .args(["-TERM", "-P", &pid])
            .output()
            .map_err(|e| e.to_string())?;
        std::process::Command::new("kill")
            .args(["-TERM", &pid])
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![bin_dir, kill_tree])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
