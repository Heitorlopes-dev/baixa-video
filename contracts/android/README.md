# Contrato entre o Rust e o plugin Kotlin (Android)

Um exemplo JSON de cada mensagem trocada entre `src-tauri/src/engine.rs` e
`YtDlpPlugin.kt`. Os dois lados conferem estes arquivos nos testes:

- Rust (`cargo test`): cada exemplo é lido no tipo correspondente e reescrito igual;
  campo desconhecido é recusado.
- Kotlin (`./gradlew testUniversalDebugUnitTest` em `src-tauri/gen/android`): cada
  classe Kotlin gera exatamente o exemplo; o pedido é lido na classe de argumentos.

Mudou um campo? Mude aqui primeiro; o teste do lado que ficou para trás falha.
