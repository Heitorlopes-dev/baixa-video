# Baixa Vídeo

App de desktop para baixar vídeo ou áudio a partir de um link, feito para quem
não quer abrir terminal. Por baixo roda o [yt-dlp](https://github.com/yt-dlp/yt-dlp)
com o ffmpeg e o Deno (runtime JavaScript que o YouTube passou a exigir),
embutidos no instalador. A saída do yt-dlp aparece num painel
dentro da janela ("Mostrar detalhes").

Stack: Tauri 2 (Rust mínimo) + React + TypeScript + Tailwind, gerenciado com Bun.

## Para quem vai usar

**Windows**

1. Baixe o instalador `.exe` na aba Releases do repositório.
2. Instale (não pede administrador; vai para a pasta do usuário).
3. Cole o link, escolha a pasta e o formato, clique em **Baixar**.
4. Se o YouTube mudar algo e o download parar de funcionar, clique em
   **Atualizar yt-dlp** e tente de novo.
5. Quando sair uma versão nova do app, aparece uma faixa azul no topo da janela.
   Clique em **Atualizar agora**: ele baixa, instala e abre a versão nova.
   (Quem tem a 0.1.0 precisa instalar a próxima à mão uma vez: a atualização
   automática chegou depois dela.)

**Linux**

1. Baixe o `Baixa-Video_<versão>_amd64.AppImage` na aba Releases.
2. Dê permissão de execução (botão direito, Propriedades, "Permitir executar como
   programa") ou rode `chmod +x Baixa-Video_*.AppImage`.
3. Dois cliques para abrir. Se a distribuição reclamar de FUSE, instale o pacote
   `libfuse2` (no Ubuntu 24.04 ou mais novo: `libfuse2t64`).
4. O AppImage se atualiza pela mesma faixa azul. Ele não tem o botão "Atualizar
   yt-dlp": lá dentro os arquivos são só de leitura, e o yt-dlp novo chega com a
   atualização do app.

## Para quem vai mexer no código

```bash
bun install
bun run sidecars        # baixa yt-dlp, ffmpeg, ffprobe e deno para o seu sistema
bun run tauri dev       # abre o app (precisa do Rust e, no Linux, do webkit2gtk)
bun run ok              # tipos, testes e build do front
```

### Gerar o instalador Windows neste Linux

Testado no Ubuntu. Pré-requisitos, uma vez só:

```bash
sudo apt install -y nsis llvm lld clang libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev build-essential pkg-config libssl-dev
cargo install cargo-xwin --locked
```

Depois:

```bash
bun run sidecars x86_64-pc-windows-msvc   # yt-dlp.exe, ffmpeg.exe, ffprobe.exe, deno.exe
export TAURI_SIGNING_PRIVATE_KEY=~/.tauri/baixa-video.key
read -rs TAURI_SIGNING_PRIVATE_KEY_PASSWORD && export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
bun run build:win                         # cargo-xwin compila para Windows; na 1ª vez baixa o SDK (1,5 GB)
```

O build assina o instalador para a atualização automática, então precisa da
chave privada (veja abaixo). O instalador sai em
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
Ele não é assinado: o Windows SmartScreen avisa "editor desconhecido" na primeira
execução, e a pessoa clica em "Mais informações" e "Executar assim mesmo".

### Gerar o AppImage neste Linux

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
bun run sidecars x86_64-unknown-linux-gnu
export TAURI_SIGNING_PRIVATE_KEY=~/.tauri/baixa-video.key
read -rs TAURI_SIGNING_PRIVATE_KEY_PASSWORD && export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
bun run build:linux
```

Sai em `src-tauri/target/release/bundle/appimage/`. O AppImage exige como mínimo a
glibc da máquina que compilou; o oficial sai do Ubuntu 22.04 no Actions para rodar
em mais distribuições. Para testar sem a chave, desligue os artefatos assinados só
naquele build: `bun run build:linux --config '{"bundle":{"createUpdaterArtifacts":false}}'`.

### Gerar pelo GitHub Actions

Os instaladores oficiais saem do workflow `.github/workflows/build.yml`: um job no
Windows (`.exe`), um no Ubuntu 22.04 (AppImage) e um terceiro que junta as duas
plataformas no `latest.json` (`scripts/release-manifest.ts`) e publica:

- `git tag v0.1.0 && git push --tags` → cria a Release com o `.exe` anexado.
- Rodar o workflow à mão pela aba Actions → o `.exe` fica como artefato do job.

## Atualização automática

O app usa o plugin de atualização do Tauri. Ao abrir, ele lê
`https://github.com/Heitorlopes-dev/baixa-video/releases/latest/download/latest.json`
e, se a versão de lá for maior, mostra a faixa "Atualizar agora". O instalador baixado
só é aceito se a assinatura bater com a chave pública que está no `tauri.conf.json`.

- **Chave privada**: `~/.tauri/baixa-video.key`, com senha. Guardada fora do git (gerenciador
  de senhas) e nos secrets `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  do repositório. Se ela se perder, os apps instalados não aceitam mais atualização e cada
  pessoa precisa reinstalar à mão uma vez com uma chave nova.
- **Lançar uma versão**: suba `version` em `src-tauri/tauri.conf.json` (e, para manter em dia,
  em `package.json` e `src-tauri/Cargo.toml`), faça o merge na `main` e crie a tag com a
  mesma versão: `git tag v0.3.0 && git push origin v0.3.0`. O workflow monta o `.exe` e o
  AppImage assinados (`scripts/release-files.ts`), junta as duas plataformas no `latest.json`
  (`scripts/release-manifest.ts`) e publica tudo na Release. Se a tag não bater com a versão,
  ou se faltar o instalador de alguma plataforma, o workflow falha antes de publicar.

## Como funciona

- `src/lib/ytdlp.ts`: monta os argumentos do yt-dlp por formato e lê o progresso
  e o caminho final do arquivo da saída. Puro, testado com `bun test`.
- `src/App.tsx`: a tela. Dispara o sidecar com `@tauri-apps/plugin-shell`, escolhe
  pasta com `plugin-dialog` e abre o arquivo no Explorer com `plugin-opener`.
- `src-tauri/src/lib.rs`: `bin_dir` devolve a pasta do executável, para o yt-dlp
  achar o ffmpeg e o deno instalados junto; `kill_tree` encerra o yt-dlp e os
  filhos dele (ffmpeg) quando a pessoa cancela.
- `scripts/fetch-sidecars.sh`: baixa os binários com o sufixo de alvo que o Tauri
  exige em `externalBin`. Versões fixas no topo do script, com SHA-256 conferido,
  para duas builds da mesma tag saírem iguais. Para subir uma versão: edite a
  variável, rode com `CHECK=0`, copie os hashes impressos para a tabela.
- `src-tauri/capabilities/default.json`: a permissão do sidecar valida cada
  argumento pela posição e descarta o que passar da lista, então toda chamada ao
  yt-dlp tem exatamente `ARGS_LEN` argumentos (as mais curtas são completadas com
  `--no-playlist` repetido). O teste em `src/lib/ytdlp.test.ts` lê o JSON e trava isso.
