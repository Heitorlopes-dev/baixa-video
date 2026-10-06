# Baixa Vídeo

App para baixar vídeo ou áudio a partir de um link, feito para quem não quer abrir
terminal. Roda no Windows, no Linux e no Android. Por baixo roda o
[yt-dlp](https://github.com/yt-dlp/yt-dlp) com o ffmpeg e um runtime JavaScript, que o
YouTube passou a exigir (o Deno no desktop, o QuickJS-NG no Android), tudo embutido no
instalador. A saída do yt-dlp aparece num painel dentro do app ("Mostrar detalhes").

Stack: Tauri 2 (Rust mínimo) + React + TypeScript + Tailwind, gerenciado com Bun. No
Android, um plugin Kotlin sobre a [youtubedl-android](https://github.com/yausername/youtubedl-android).

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

**Android** (10 ou mais novo, celular de 64 bits: praticamente todos dos últimos anos)

1. No celular, abra a aba Releases do repositório e baixe o
   `Baixa-Video_<versão>_arm64.apk` (uns 60 MB).
2. Toque no arquivo baixado. Na primeira vez o Android pede para permitir que o
   navegador (ou o app de arquivos) instale apps: toque em **Configurações**, ative
   **Permitir desta fonte** e volte.
3. O Play Protect pode avisar que não conhece o app, porque ele não vem da Play Store:
   toque em **Mais detalhes** e **Instalar mesmo assim** (o texto muda um pouco de uma
   marca de celular para outra). Se ele oferecer enviar o app para análise, tanto faz.
4. Na primeira vez que abrir, o app atualiza o yt-dlp sozinho ("Atualizando o
   yt-dlp…", poucos segundos): o que vem dentro do APK é antigo, e o YouTube recusa o
   download no meio (erro 403) até ele ser atualizado. Depois disso, ele só se atualiza
   sozinho de novo se ficar mais de 90 dias sem atualização.
5. Cole o link, escolha o formato e toque em **Baixar**. Ou, no YouTube (ou em outro
   app), toque em **Compartilhar** e escolha **Baixa Vídeo**: ele abre com o link
   preenchido. No primeiro download o Android pergunta se o app pode mandar
   notificações: permita, é por ela que se acompanha o progresso com a tela apagada.
6. O arquivo vai para `Downloads/BaixaVideo`, ou para a pasta escolhida em **Escolher
   pasta**. O download continua com a tela apagada, com o progresso na notificação; ao
   terminar, tocar na notificação abre o arquivo.
7. Se o YouTube mudar algo e o download parar de funcionar, toque em **Atualizar
   yt-dlp** e tente de novo.
8. Quando sair uma versão nova, aparece uma faixa azul no topo com o botão **Baixar**:
   ele abre o APK novo no navegador, e é só instalar por cima (a pasta escolhida
   continua valendo). Quem prefere não depender disso pode usar o
   [Obtainium](https://github.com/ImranR98/Obtainium): **Adicionar app**, cole
   `https://github.com/Heitorlopes-dev/baixa-video` e confirme. Ele confere as
   Releases, avisa da versão nova e instala o APK.

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

### Gerar o APK do Android neste Linux

Pré-requisitos, uma vez só: JDK 17, o Android SDK (pelas
[command-line tools](https://developer.android.com/studio#command-tools), em
`~/Android/Sdk`) e o alvo do Rust para o celular.

```bash
sudo apt install -y openjdk-17-jdk
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "ndk;30.0.16248370"
rustup target add aarch64-linux-android
```

Depois:

```bash
export ANDROID_HOME=~/Android/Sdk NDK_HOME=~/Android/Sdk/ndk/30.0.16248370 \
  JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
bun run sidecars aarch64-linux-android                       # QuickJS-NG em jniLibs/ (fora do git)
bun run tauri android build --apk --target aarch64 --debug   # teste: aceita inspeção, ~160 MB
bun run tauri android build --apk --target aarch64           # release, ~60 MB
```

Os APKs saem em `src-tauri/gen/android/app/build/outputs/apk/universal/{debug,release}/`.
O APK é só arm64 (o yt-dlp, o Python e o ffmpeg da youtubedl-android ocupam a maior
parte do tamanho, e cada arquitetura a mais repetiria tudo). Sem a chave, o de release
sai assinado com a chave de depuração, o que serve para testar mas não para publicar.
Para assinar com a chave de verdade (veja abaixo):

```bash
export ANDROID_KEYSTORE_PATH=~/.android-keys/baixa-video.jks
read -rs ANDROID_KEYSTORE_PASSWORD && export ANDROID_KEYSTORE_PASSWORD
bun run tauri android build --apk --target aarch64
```

O alias padrão é `baixa-video`; `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` trocam o
alias e a senha da chave, se um dia forem diferentes.

**Instalar no celular pelo cabo:** `adb install -r <apk>`. Celulares Xiaomi bloqueiam o
`adb install` sem conta Mi; nesse caso, `adb push <apk> /sdcard/Download/` e instale
pelo app de arquivos. Um APK assinado com a chave de verdade não instala por cima de um
de teste (assinado com a de depuração), nem o contrário: desinstale o outro antes.

**Inspecionar o app de teste:** com o APK de debug aberto e o cabo ligado, a tela
aparece em `chrome://inspect` no Chrome do computador (console, rede e elementos do
WebView).

**Testar no emulador:** o APK oficial é só arm64, e o emulador deste PC é x86_64.
A imagem do Android 15 (`system-images;android-35;google_apis;x86_64`) traduz ARM, então
o APK arm64 instala e abre, mas o download falha: o tradutor tenta carregar o
`libandroid.so` ARM que a youtubedl-android põe no `LD_LIBRARY_PATH` e para com
`CANNOT LINK EXECUTABLE "/system/bin/ndk_translation_program_runner_binfmt_misc_arm64"`.
A do Android 13 (API 33) nem traduz. Num celular de verdade nada disso acontece. Para
testar o fluxo inteiro, gere um APK x86_64 só para o emulador:

```bash
sdkmanager emulator "system-images;android-35;google_apis;x86_64"
avdmanager create avd -n bv-api35 -k "system-images;android-35;google_apis;x86_64" -d pixel_6
$ANDROID_HOME/emulator/emulator -avd bv-api35 &
# QuickJS-NG x86_64 (o script só baixa o arm64; este fica sem conferência de hash)
mkdir -p src-tauri/gen/android/app/src/main/jniLibs/x86_64
curl -fsSL -o src-tauri/gen/android/app/src/main/jniLibs/x86_64/libqjsng.so \
  https://github.com/quickjs-ng/quickjs/releases/download/v0.17.0/qjs-linux-x86_64
chmod +x src-tauri/gen/android/app/src/main/jniLibs/x86_64/libqjsng.so
bun run tauri android build --apk --target x86_64          # release: passa pelo otimizador (R8)
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Teste a release, não só o debug: o otimizador só roda na release e já quebrou o app na
abertura sem que o debug mostrasse nada (veja `proguard-rules.pro`). A imagem do
Android 13 serve para conferir o visual num WebView antigo: ela vem com o Chrome 109,
que não se atualiza sem Play Store. O CSS sai compatível a partir do Chrome 99
(`build.cssTarget` no `vite.config.ts`); abaixo disso o Tailwind 4 não funciona.

**Testes do lado nativo:** `cargo test` em `src-tauri` confere o contrato com o Kotlin
(`contracts/android/*.json`), e `./gradlew testUniversalDebugUnitTest` em
`src-tauri/gen/android` roda os testes do Kotlin, que leem os mesmos exemplos.

### Gerar pelo GitHub Actions

Os instaladores oficiais saem do workflow `.github/workflows/build.yml`: um job no
Windows (`.exe`), um no Ubuntu 22.04 (AppImage), um no Ubuntu para o APK do Android e
um quarto que junta tudo no `latest.json` (`scripts/release-manifest.ts`) e publica:

- `git tag v0.4.0 && git push origin v0.4.0` → cria a Release com o `.exe`, o
  AppImage, o APK e o `latest.json`.
- Rodar o workflow à mão pela aba Actions → o `.exe` fica como artefato do job.
- Push na `main` → build completo sem publicar: testa tudo que entrou e deixa o cache de
  compilação pronto para a próxima tag, que assim não compila as dependências do zero.

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

**No Android** o plugin do Tauri não existe. O app lê o mesmo `latest.json`, compara a
versão e, se houver uma maior, mostra a faixa com o link do APK (campo `android.url`).
Quem instala é o próprio Android, que só aceita o APK novo por cima do antigo se os
dois forem assinados com a mesma chave.

- **Chave do APK**: `~/.android-keys/baixa-video.jks` (PKCS12), alias `baixa-video`,
  com senha, e um certificado que diz só `CN=Baixa Video`. Guardada fora do git
  (gerenciador de senhas) e nos secrets `ANDROID_KEYSTORE_BASE64` (o arquivo em base64)
  e `ANDROID_KEYSTORE_PASSWORD`. O job Android falha antes do build se a chave faltar
  ou se a senha não abrir o arquivo, para nunca publicar um APK assinado com a chave de
  depuração. Se ela se perder, o Android recusa as versões novas por cima da instalada:
  cada pessoa precisa desinstalar e instalar de novo, uma vez.
- **Conferir um APK**: `apksigner verify --print-certs Baixa-Video_<versão>_arm64.apk`
  (fica em `build-tools/` do SDK) tem que mostrar `CN=Baixa Video` e o SHA-256
  `cae67175c6c7c047aab039e387b8b58965f1d3d95b194b6eabb6c197de02095a`.

## Como funciona

**Organização do front:** a tela (`src/App.tsx`) só desenha. O ciclo do download é
uma máquina de estados pura em `src/lib/download.ts` (testada em `download.test.ts`),
ligada a um motor de download pelo gancho `src/hooks/useDownload.ts`. O motor
(`src/lib/engine.ts`) tem uma implementação por plataforma:

- `src/lib/engines/desktop.ts`: roda o yt-dlp embutido como sidecar. Tudo que toca o
  Tauri para rodar ou parar o processo fica em `src/lib/sidecar.ts`.
- `src/lib/engines/android.ts`: chama comandos tipados do Rust e recebe o progresso por
  um `Channel`. Os comandos estão em `src-tauri/src/engine.rs` (no desktop respondem
  `Unsupported`) e a implementação em `src-tauri/src/android.rs`, que chama o plugin
  Kotlin e valida em modo estrito tudo que volta dele. O formato de cada mensagem tem
  um exemplo em `contracts/android/`, conferido pelos dois lados.
- O Kotlin fica em `src-tauri/gen/android/app/src/main/java/dev/heitorlopes/baixa_video/`:
  `YtDlpPlugin.kt` (download, cancelar, atualizar o yt-dlp, publicar o arquivo em
  Downloads ou na pasta escolhida, abrir, compartilhar, versão nova, seletor de pasta)
  e `DownloadService.kt` (serviço em primeiro plano e notificações, para o download
  seguir com a tela apagada).

**Ponte com o Rust tipada:** `src/bindings.ts` é gerado pelo tauri-specta a partir dos
comandos em `src-tauri/src/lib.rs`. Não edite à mão. Ao mudar um comando Rust, rode
`bun run gen:bindings` (ou só abra o app com `bun run tauri dev`, que regenera o arquivo)
e commite o resultado junto.

- `src/lib/ytdlp.ts`: monta os argumentos do yt-dlp por formato e lê o progresso
  e o caminho final do arquivo da saída. Puro, testado com `bun test`.
- `src/App.tsx`: a tela. Pega o motor da plataforma com `useEngine`
  (`src/hooks/usePlatform.ts`). A pasta, no desktop, sai do `plugin-dialog`; no
  Android, quem guarda e troca é o motor (`src/hooks/useDestination.ts`).
- `src-tauri/src/lib.rs`: `bin_dir` devolve a pasta do executável, para o yt-dlp
  achar o ffmpeg e o deno instalados junto; `kill_tree` encerra o yt-dlp e os
  filhos dele (ffmpeg) quando a pessoa cancela.
- `scripts/fetch-sidecars.sh`: baixa os binários com o sufixo de alvo que o Tauri
  exige em `externalBin` (com o alvo `aarch64-linux-android`, só o QuickJS-NG, que vai
  no APK como `libqjsng.so`). Versões fixas no topo do script, com SHA-256 conferido,
  para duas builds da mesma tag saírem iguais. Para subir uma versão: edite a
  variável, rode com `CHECK=0`, copie os hashes impressos para a tabela.
- `src-tauri/capabilities/default.json`: a permissão do sidecar valida cada
  argumento pela posição e descarta o que passar da lista, então toda chamada ao
  yt-dlp tem exatamente `ARGS_LEN` argumentos (as mais curtas são completadas com
  `--no-playlist` repetido). O teste em `src/lib/ytdlp.test.ts` lê o JSON e trava isso.
