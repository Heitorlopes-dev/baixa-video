//! Motor do Android: implementa os comandos de src/engine.rs chamando o plugin
//! Kotlin YtDlpPlugin (youtubedl-android). Tudo que volta do Kotlin é validado em
//! modo estrito; o formato de cada mensagem está em contracts/android/.
use crate::engine::{
    update_endpoint, CancelReply, CancelRequest, CheckUpdateRequest, Destination, DownloadRequest, EngineError, EngineEvent,
    LatestRelease,
    OpenRequest, SharedText, UpdateResult, VersionReply,
};
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
    call::<CancelReply>(app, "cancel", CancelRequest { id }).map(|r| r.cancelled)
}

pub fn update(app: &AppHandle) -> Result<UpdateResult, EngineError> {
    call(app, "update", ())
}

pub fn version(app: &AppHandle) -> Result<String, EngineError> {
    call::<VersionReply>(app, "version", ()).map(|r| r.version)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchSharedPayload {
    on_shared: Channel<SharedText>,
}

pub fn watch_shared(app: &AppHandle, on_shared: Channel<SharedText>) -> Result<(), EngineError> {
    call::<IgnoredAny>(app, "watchShared", WatchSharedPayload { on_shared }).map(|_| ())
}

pub fn destination(app: &AppHandle) -> Result<Destination, EngineError> {
    call(app, "destination", ())
}

/// Espera a pessoa escolher (ou cancelar) no seletor do Android.
pub fn pick_folder(app: &AppHandle) -> Result<Destination, EngineError> {
    call(app, "pickFolder", ())
}

pub fn latest_release(app: &AppHandle) -> Result<LatestRelease, EngineError> {
    let url = update_endpoint(app).ok_or_else(|| EngineError::Bridge("endereço do latest.json ausente no tauri.conf.json".into()))?;
    call(app, "checkUpdate", CheckUpdateRequest { url })
}

pub fn open(app: &AppHandle, uri: String) -> Result<(), EngineError> {
    call::<IgnoredAny>(app, "open", OpenRequest { uri }).map(|_| ())
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
