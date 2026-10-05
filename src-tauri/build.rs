fn main() {
    // Plugin embutido do Android (src/android.rs): declara os comandos e libera
    // todos por padrão; a capability src-tauri/capabilities/android.json usa ytdlp:default.
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "ytdlp",
            tauri_build::InlinedPlugin::new()
                .commands(&["init", "version", "update", "start", "poll", "cancel"])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("falha no build do Tauri");
}
