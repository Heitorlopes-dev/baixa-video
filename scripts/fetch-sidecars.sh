#!/usr/bin/env bash
# Baixa yt-dlp, ffmpeg, ffprobe e deno para src-tauri/binaries com o sufixo do
# alvo, que é o nome que o Tauri exige para externalBin.
# Uso: scripts/fetch-sidecars.sh [alvo]   (padrão: o host do rustc)
set -euo pipefail

TARGET="${1:-$(rustc -vV | sed -n 's/^host: //p')}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src-tauri/binaries"
mkdir -p "$DIR"

case "$TARGET" in
	x86_64-pc-windows-msvc)
		EXT=".exe"; YTDLP="yt-dlp.exe"; FF="ffmpeg-master-latest-win64-gpl"; FF_ARCHIVE="zip" ;;
	x86_64-unknown-linux-gnu)
		EXT=""; YTDLP="yt-dlp_linux"; FF="ffmpeg-master-latest-linux64-gpl"; FF_ARCHIVE="tar.xz" ;;
	*)
		echo "alvo sem suporte: $TARGET" >&2; exit 1 ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Extrai só os membros pedidos de um zip (python porque o tar do Linux não abre zip).
unzip_members() { # unzip_members <zip> <destino> <membro>...
	python3 - "$@" <<'PY'
import sys, zipfile
archive, dest, *members = sys.argv[1:]
with zipfile.ZipFile(archive) as z:
    for m in members:
        z.extract(m, dest)
PY
}

echo "yt-dlp ($TARGET)"
curl -fsSL -o "$DIR/yt-dlp-$TARGET$EXT" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP"

echo "ffmpeg + ffprobe ($TARGET)"
curl -fsSL -o "$TMP/ff.$FF_ARCHIVE" "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/$FF.$FF_ARCHIVE"
if [ "$FF_ARCHIVE" = "zip" ]; then
	unzip_members "$TMP/ff.zip" "$TMP" "$FF/bin/ffmpeg$EXT" "$FF/bin/ffprobe$EXT"
else
	tar -xf "$TMP/ff.$FF_ARCHIVE" -C "$TMP" "$FF/bin/ffmpeg$EXT" "$FF/bin/ffprobe$EXT"
fi
mv "$TMP/$FF/bin/ffmpeg$EXT" "$DIR/ffmpeg-$TARGET$EXT"
mv "$TMP/$FF/bin/ffprobe$EXT" "$DIR/ffprobe-$TARGET$EXT"

echo "deno ($TARGET)"
curl -fsSL -o "$TMP/deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-$TARGET.zip"
unzip_members "$TMP/deno.zip" "$TMP" "deno$EXT"
mv "$TMP/deno$EXT" "$DIR/deno-$TARGET$EXT"

chmod +x "$DIR"/*
ls -la "$DIR"
