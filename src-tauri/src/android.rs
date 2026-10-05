//! Ponte com o plugin Kotlin YtDlpPlugin (youtubedl-android). Só existe no Android.
//! Os comandos rodam fora da thread principal (async) porque o Kotlin responde por ela.
//! Presa ao runtime padrão (Wry): o app só usa ele, e o macro de comandos não aceita genéricos.
use serde_json::Value;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, State, Wry};

struct YtDlp(PluginHandle<Wry>);

fn call(ytdlp: &YtDlp, command: &str, payload: Value) -> Result<Value, String> {
    ytdlp.0.run_mobile_plugin(command, payload).map_err(|e| e.to_string())
}

#[tauri::command]
async fn init(ytdlp: State<'_, YtDlp>) -> Result<Value, String> {
    call(&ytdlp, "init", Value::Null)
}

#[tauri::command]
async fn version(ytdlp: State<'_, YtDlp>) -> Result<Value, String> {
    call(&ytdlp, "version", Value::Null)
}

#[tauri::command]
async fn update(ytdlp: State<'_, YtDlp>) -> Result<Value, String> {
    call(&ytdlp, "update", Value::Null)
}

#[tauri::command]
async fn start(ytdlp: State<'_, YtDlp>, payload: Value) -> Result<Value, String> {
    call(&ytdlp, "start", payload)
}

#[tauri::command]
async fn poll(ytdlp: State<'_, YtDlp>) -> Result<Value, String> {
    call(&ytdlp, "poll", Value::Null)
}

#[tauri::command]
async fn cancel(ytdlp: State<'_, YtDlp>, payload: Value) -> Result<Value, String> {
    call(&ytdlp, "cancel", payload)
}

pub fn init_plugin() -> TauriPlugin<Wry> {
    Builder::new("ytdlp")
        .invoke_handler(tauri::generate_handler![init, version, update, start, poll, cancel])
        .setup(|app, api| {
            let handle = api.register_android_plugin("dev.heitorlopes.baixa_video", "YtDlpPlugin")?;
            app.manage(YtDlp(handle));
            Ok(())
        })
        .build()
}
