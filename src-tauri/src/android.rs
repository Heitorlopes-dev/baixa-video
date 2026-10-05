//! Motor do Android: implementa os comandos de src/engine.rs chamando o plugin
//! Kotlin YtDlpPlugin (youtubedl-android). Tudo que volta do Kotlin é validado em
//! modo estrito; o formato de cada mensagem está em contracts/android/.
use crate::engine::{CancelReply, DownloadRequest, EngineError, EngineEvent, UpdateResult, VersionReply};
use serde::de::{DeserializeOwned, IgnoredAny};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Wry};

/// Presa ao runtime padrão (Wry), que é o único que o app usa.
struct YtDlp(PluginHandle<Wry>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StartPayload {
    request: DownloadRequest,
    on_event: Channel<EngineEvent>,
}

#[derive(Serialize)]
struct CancelPayload {
    id: String,
}

fn call<T: DeserializeOwned>(app: &AppHandle, command: &str, payload: impl Serialize) -> Result<T, EngineError> {
    let ytdlp = app
        .try_state::<YtDlp>()
        .ok_or_else(|| EngineError::Bridge("plugin do yt-dlp não registrado".into()))?;
    ytdlp
        .0
        .run_mobile_plugin(command, payload)
        .map_err(|e| EngineError::Bridge(e.to_string()))
}

/// Responde assim que o download começa; linhas e fim chegam pelo canal.
pub fn start(app: &AppHandle, request: DownloadRequest, on_event: Channel<EngineEvent>) -> Result<(), EngineError> {
    call::<IgnoredAny>(app, "start", StartPayload { request, on_event }).map(|_| ())
}

pub fn cancel(app: &AppHandle, id: String) -> Result<bool, EngineError> {
    call::<CancelReply>(app, "cancel", CancelPayload { id }).map(|r| r.cancelled)
}

pub fn update(app: &AppHandle) -> Result<UpdateResult, EngineError> {
    call(app, "update", ())
}

pub fn version(app: &AppHandle) -> Result<String, EngineError> {
    call::<VersionReply>(app, "version", ()).map(|r| r.version)
}

pub fn init_plugin() -> TauriPlugin<Wry> {
    Builder::new("ytdlp")
        .setup(|app, api| {
            let handle = api.register_android_plugin("dev.heitorlopes.baixa_video", "YtDlpPlugin")?;
            app.manage(YtDlp(handle));
            Ok(())
        })
        .build()
}
