#[cfg(target_os = "android")]
mod android;
mod engine;

#[cfg(any(desktop, test))]
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

/// Pasta onde está o executável do app. Os sidecars (yt-dlp, ffmpeg, ffprobe, deno)
/// são copiados para cá na instalação, e o yt-dlp recebe isso em --ffmpeg-location.
#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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

/// Rodando de dentro de um AppImage? Lá os sidecars ficam num sistema de arquivos
/// só de leitura, então `yt-dlp -U` sempre falharia; o yt-dlp novo vem com a
/// atualização do app.
#[tauri::command]
#[specta::specta]
fn is_appimage() -> bool {
    std::env::var_os("APPIMAGE").is_some()
}

/// Comandos que a tela pode chamar. As funções TypeScript em src/bindings.ts são
/// geradas daqui (tauri-specta): nome, parâmetros e retorno vêm do Rust.
fn commands() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        bin_dir,
        kill_tree,
        is_appimage,
        engine::platform,
        engine::engine_start,
        engine::engine_cancel,
        engine::engine_update,
        engine::engine_version
    ])
}

#[cfg(any(desktop, test))]
/// Ancorado na pasta do crate (fixada na compilação), não na pasta de onde o
/// processo foi aberto: assim o arquivo sempre cai em src/bindings.ts.
const BINDINGS_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts");
#[cfg(any(desktop, test))]
const BINDINGS_HEADER: &str =
    "// Gerado por tauri-specta a partir de src-tauri/src/lib.rs. Não edite à mão: rode `bun run gen:bindings`.";

#[cfg(any(desktop, test))]
fn export_bindings(builder: &Builder<tauri::Wry>) {
    builder
        .export(Typescript::default().header(BINDINGS_HEADER), BINDINGS_PATH)
        .expect("falha ao exportar src/bindings.ts");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = commands();

    // Em `tauri dev` no desktop o arquivo se regenera sozinho a cada execução.
    // No celular não: o caminho é desta máquina de desenvolvimento e não existe
    // lá, e a falha ao gravar derrubava o app logo ao abrir.
    #[cfg(all(debug_assertions, desktop))]
    export_bindings(&builder);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    // No Android o yt-dlp roda pelo plugin Kotlin (src/android.rs).
    #[cfg(target_os = "android")]
    let app = app.plugin(android::init_plugin());

    // Atualização automática e reinício só existem no desktop.
    #[cfg(desktop)]
    let app = app
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    app.invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    /// `bun run gen:bindings`: gera src/bindings.ts sem abrir o app.
    #[test]
    fn export_bindings() {
        super::export_bindings(&super::commands());
    }
}
