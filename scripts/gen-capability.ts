// Gera src-tauri/capabilities/default.json a partir de ARGS_LEN e ALLOWED_FLAGS.
// Roda antes de `dev` e `build` (package.json), e o teste confere que o
// arquivo commitado é igual ao gerado. Fonte única: src/lib/ytdlp.ts.
import { ARGS_LEN, ARG_VALIDATOR } from "../src/lib/ytdlp";

export function capabilityJson(): string {
  const capability = {
    $schema: "../gen/schemas/desktop-schema.json",
    identifier: "default",
    description:
      "Janela principal: roda o yt-dlp como sidecar, escolhe pasta, abre o arquivo baixado e instala atualizações do app. Gerado por scripts/gen-capability.ts; não edite à mão.",
    windows: ["main"],
    permissions: [
      "core:default",
      "opener:default",
      "dialog:default",
      "shell:allow-kill",
      "updater:default",
      "process:allow-restart",
      {
        identifier: "shell:allow-spawn",
        allow: [
          {
            name: "binaries/yt-dlp",
            sidecar: true,
            args: Array.from({ length: ARGS_LEN }, () => ({ validator: ARG_VALIDATOR })),
          },
        ],
      },
    ],
  };
  return `${JSON.stringify(capability, null, 2)}\n`;
}

if (import.meta.main) {
  const path = new URL("../src-tauri/capabilities/default.json", import.meta.url);
  await Bun.write(path, capabilityJson());
  console.log(`capabilities/default.json gerado: ${ARGS_LEN} posições`);
}
