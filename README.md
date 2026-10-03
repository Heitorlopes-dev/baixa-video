# Baixa Vídeo

App de desktop para baixar vídeo ou áudio a partir de um link, feito para quem
não quer abrir terminal. Por baixo roda o [yt-dlp](https://github.com/yt-dlp/yt-dlp)
com o ffmpeg e o Deno (runtime JavaScript que o YouTube passou a exigir),
embutidos no instalador. A saída do yt-dlp aparece num painel
dentro da janela ("Mostrar detalhes").

Stack: Tauri 2 (Rust mínimo) + React + TypeScript + Tailwind, gerenciado com Bun.

## Para quem vai usar

1. Baixe o instalador `.exe` na aba Releases do repositório.
2. Instale (não pede administrador; vai para a pasta do usuário).
3. Cole o link, escolha a pasta e o formato, clique em **Baixar**.
4. Se o YouTube mudar algo e o download parar de funcionar, clique em
   **Atualizar yt-dlp** e tente de novo.

## Para quem vai mexer no código

```bash
bun install
bun run sidecars        # baixa yt-dlp, ffmpeg, ffprobe e deno para o seu sistema
bun run tauri dev       # abre o app (precisa do Rust e, no Linux, do webkit2gtk)
bun run ok              # tipos, testes e build do front
```

O instalador para Windows é gerado pelo GitHub Actions (`.github/workflows/build.yml`)
num runner Windows:

- `git tag v0.1.0 && git push --tags` → cria a Release com o `.exe` anexado.
- Rodar o workflow à mão pela aba Actions → o `.exe` fica como artefato do job.

## Como funciona

- `src/lib/ytdlp.ts`: monta os argumentos do yt-dlp por formato e lê o progresso
  e o caminho final do arquivo da saída. Puro, testado com `bun test`.
- `src/App.tsx`: a tela. Dispara o sidecar com `@tauri-apps/plugin-shell`, escolhe
  pasta com `plugin-dialog` e abre o arquivo no Explorer com `plugin-opener`.
- `src-tauri/src/lib.rs`: um comando que devolve a pasta do executável, para o
  yt-dlp achar o ffmpeg e o deno que foram instalados junto.
- `src-tauri/capabilities/default.json`: permissões. O front só pode executar o
  sidecar `yt-dlp`, nada mais.
- `scripts/fetch-sidecars.sh`: baixa os binários com o sufixo de alvo que o Tauri
  exige em `externalBin`.
