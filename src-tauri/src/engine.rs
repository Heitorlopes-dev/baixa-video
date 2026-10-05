//! Motor de download: o contrato tipado entre a tela e o yt-dlp.
//!
//! Os comandos existem em todas as plataformas, para os bindings TypeScript serem
//! os mesmos. No desktop o yt-dlp ainda roda pela tela (sidecar), então aqui eles
//! respondem `Unsupported`; no Android chamam o plugin Kotlin (src/android.rs).
//! O formato de cada mensagem com o Kotlin tem um exemplo em contracts/android/.
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::ipc::Channel;
use tauri::AppHandle;

#[derive(Serialize, Type, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Platform {
    Desktop,
    Android,
}

/// Um download: identificador (para cancelar), link e os argumentos do yt-dlp já montados pela tela.
#[derive(Deserialize, Serialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DownloadRequest {
    pub id: String,
    pub url: String,
    pub args: Vec<String>,
}

#[derive(Deserialize, Serialize, Type, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Stream {
    Stdout,
    Stderr,
}

/// O que chega pelo canal durante um download: uma linha do yt-dlp ou o fim.
/// `code` nulo quer dizer que o processo não terminou sozinho (cancelado).
#[derive(Deserialize, Serialize, Type, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum EngineEvent {
    Line { text: String, stream: Stream },
    Exit { code: Option<i32> },
}

#[derive(Deserialize, Serialize, Type, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum UpdateStatus {
    Done,
    AlreadyUpToDate,
}

#[derive(Deserialize, Serialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateResult {
    pub status: UpdateStatus,
    pub version: String,
}

#[derive(Serialize, Type, Clone, Debug)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum EngineError {
    /// Este motor não existe nesta plataforma.
    #[cfg_attr(target_os = "android", allow(dead_code))] // só o desktop responde isso
    Unsupported,
    /// Falha na ponte com o plugin nativo ou dentro dele.
    #[cfg_attr(not(target_os = "android"), allow(dead_code))] // só o motor do Android (e os testes) usam
    Bridge(String),
}

// Respostas do Kotlin que só o Rust lê (não vão para a tela).
#[cfg_attr(not(target_os = "android"), allow(dead_code))] // só o motor do Android (e os testes) usam
#[derive(Deserialize, Serialize, Debug)]
#[serde(deny_unknown_fields)]
pub(crate) struct VersionReply {
    pub version: String,
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))] // só o motor do Android (e os testes) usam
#[derive(Deserialize, Serialize, Debug)]
#[serde(deny_unknown_fields)]
pub(crate) struct CancelReply {
    pub cancelled: bool,
}

#[tauri::command]
#[specta::specta]
pub fn platform() -> Platform {
    if cfg!(target_os = "android") {
        Platform::Android
    } else {
        Platform::Desktop
    }
}

#[tauri::command]
#[specta::specta]
pub async fn engine_start(
    app: AppHandle,
    request: DownloadRequest,
    on_event: Channel<EngineEvent>,
) -> Result<(), EngineError> {
    backend::start(&app, request, on_event)
}

#[tauri::command]
#[specta::specta]
pub async fn engine_cancel(app: AppHandle, id: String) -> Result<bool, EngineError> {
    backend::cancel(&app, id)
}

#[tauri::command]
#[specta::specta]
pub async fn engine_update(app: AppHandle) -> Result<UpdateResult, EngineError> {
    backend::update(&app)
}

#[tauri::command]
#[specta::specta]
pub async fn engine_version(app: AppHandle) -> Result<String, EngineError> {
    backend::version(&app)
}

#[cfg(target_os = "android")]
use crate::android as backend;

#[cfg(not(target_os = "android"))]
mod backend {
    use super::{DownloadRequest, EngineError, EngineEvent, UpdateResult};
    use tauri::{ipc::Channel, AppHandle};

    pub fn start(_: &AppHandle, _: DownloadRequest, _: Channel<EngineEvent>) -> Result<(), EngineError> {
        Err(EngineError::Unsupported)
    }
    pub fn cancel(_: &AppHandle, _: String) -> Result<bool, EngineError> {
        Err(EngineError::Unsupported)
    }
    pub fn update(_: &AppHandle) -> Result<UpdateResult, EngineError> {
        Err(EngineError::Unsupported)
    }
    pub fn version(_: &AppHandle) -> Result<String, EngineError> {
        Err(EngineError::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::de::DeserializeOwned;
    use serde_json::{json, Value};

    fn fixture(name: &str) -> Value {
        let path = format!("{}/../contracts/android/{name}", env!("CARGO_MANIFEST_DIR"));
        let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
        serde_json::from_str(&text).unwrap_or_else(|e| panic!("{path}: {e}"))
    }

    /// O exemplo é lido no tipo e reescrito igual: nenhum campo some, nenhum aparece.
    fn round_trip<T: Serialize + DeserializeOwned>(name: &str) {
        let original = fixture(name);
        let parsed: T = serde_json::from_value(original.clone()).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(serde_json::to_value(&parsed).unwrap(), original, "{name}");
    }

    #[test]
    fn contrato_android_le_e_reescreve_cada_exemplo() {
        round_trip::<DownloadRequest>("request.json");
        round_trip::<EngineEvent>("event-line-stdout.json");
        round_trip::<EngineEvent>("event-line-stderr.json");
        round_trip::<EngineEvent>("event-exit.json");
        round_trip::<EngineEvent>("event-exit-canceled.json");
        round_trip::<UpdateResult>("update-done.json");
        round_trip::<UpdateResult>("update-up-to-date.json");
        round_trip::<VersionReply>("version.json");
        round_trip::<CancelReply>("cancel.json");
    }

    fn with_extra(name: &str) -> Value {
        let mut value = fixture(name);
        value["campoNovo"] = json!(1);
        value
    }

    #[test]
    fn campo_desconhecido_vindo_do_kotlin_e_recusado() {
        assert!(serde_json::from_value::<VersionReply>(with_extra("version.json")).is_err());
        assert!(serde_json::from_value::<CancelReply>(with_extra("cancel.json")).is_err());
        assert!(serde_json::from_value::<UpdateResult>(with_extra("update-done.json")).is_err());
        assert!(serde_json::from_value::<EngineEvent>(with_extra("event-exit.json")).is_err());
    }

    #[test]
    fn plataforma_do_build_de_teste_e_desktop() {
        assert_eq!(platform(), Platform::Desktop);
    }
}
