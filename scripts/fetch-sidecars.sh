#!/usr/bin/env bash
# Baixa yt-dlp, ffmpeg, ffprobe e deno para src-tauri/binaries com o sufixo do
# alvo, que é o nome que o Tauri exige para externalBin. Com o alvo
# aarch64-linux-android, baixa só o QuickJS-NG para o APK (veja abaixo).
# Versões fixas e SHA-256 conferido: duas builds da mesma tag saem iguais.
# Para atualizar: troque a versão, rode uma vez com CHECK=0, copie os hashes
# que o script imprime para a tabela abaixo e confira a origem.
# Uso: scripts/fetch-sidecars.sh [alvo]   (padrão: o host do rustc)
set -euo pipefail

YTDLP_VERSION="2026.08.19"
FFMPEG_TAG="autobuild-2026-10-02-22-56"
FFMPEG_BUILD="N-127117-g98e92563a3"
DENO_VERSION="v2.9.7"

QUICKJS_NG_VERSION="v0.17.0"
SHA_QUICKJS_NG_AARCH64="3372133484edf50a69f3c67903af41206d22a061e930e3cfb63269272ef56d2e"

TARGET="${1:-$(rustc -vV | sed -n 's/^host: //p')}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Android: Python, yt-dlp e ffmpeg vêm da youtubedl-android (Gradle). Daqui sai só o
# QuickJS-NG, cerca de 2x mais rápido que o QuickJS da biblioteca no desafio do YouTube.
# Vai para jniLibs com nome lib*.so: é o único jeito de o Android deixar executar.
if [ "$TARGET" = "aarch64-linux-android" ]; then
	JNI="$ROOT/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a"
	mkdir -p "$JNI"
	echo "QuickJS-NG $QUICKJS_NG_VERSION ($TARGET)"
	curl -fsSL -o "$JNI/libqjsng.so" "https://github.com/quickjs-ng/quickjs/releases/download/$QUICKJS_NG_VERSION/qjs-linux-aarch64"
	actual="$(sha256sum "$JNI/libqjsng.so" | cut -d' ' -f1)"
	echo "  sha256 libqjsng.so = $actual"
	if [ "${CHECK:-1}" = "1" ] && [ "$actual" != "$SHA_QUICKJS_NG_AARCH64" ]; then
		echo "HASH DIFERENTE em libqjsng.so (esperado $SHA_QUICKJS_NG_AARCH64)" >&2; exit 1
	fi
	chmod +x "$JNI/libqjsng.so"
	ls -la "$JNI"
	exit 0
fi

DIR="$ROOT/src-tauri/binaries"
mkdir -p "$DIR"

case "$TARGET" in
	x86_64-pc-windows-msvc)
		EXT=".exe"; YTDLP="yt-dlp.exe"; FF="ffmpeg-$FFMPEG_BUILD-win64-gpl"; FF_ARCHIVE="zip"
		SHA_YTDLP="66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a"
		SHA_FFMPEG="29816f6a9f97c8107c7f945eb6caf0da002007e5da9bfb596f90b2e5f71fce76"
		SHA_FFPROBE="5ce3355290bedf8de97325f9ccdd052dcdda64743e41a73bd7f1c1f6bff6bbb4"
		SHA_DENO="e020f3e232bd16e33768dee528e5983349c962952051ced0a5d58ad42f5d9b33" ;;
	x86_64-unknown-linux-gnu)
		EXT=""; YTDLP="yt-dlp_linux"; FF="ffmpeg-$FFMPEG_BUILD-linux64-gpl"; FF_ARCHIVE="tar.xz"
		SHA_YTDLP="58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a"
		SHA_FFMPEG="f23bd67424c774b1a78a377b3f2f996932bdc4bf28f9a3f05b5037b3615db147"
		SHA_FFPROBE="a1008407f6b73e3a7c9bbb722ee8b61dc813738a8fde6e85a4847c6d596ac2e1"
		SHA_DENO="ce6a052beb97c2b92de67077e3f3924ba7c9661ede0d8dc2f66a116a3c841f21" ;;
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

check() { # check <arquivo> <sha256 esperado>
	local actual
	actual="$(sha256sum "$1" | cut -d' ' -f1)"
	echo "  sha256 $(basename "$1") = $actual"
	if [ "${CHECK:-1}" = "1" ] && [ "$actual" != "$2" ]; then
		echo "HASH DIFERENTE em $1 (esperado $2)" >&2; exit 1
	fi
}

echo "yt-dlp $YTDLP_VERSION ($TARGET)"
curl -fsSL -o "$DIR/yt-dlp-$TARGET$EXT" "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/$YTDLP"
check "$DIR/yt-dlp-$TARGET$EXT" "$SHA_YTDLP"

echo "ffmpeg + ffprobe $FFMPEG_BUILD ($TARGET)"
curl -fsSL -o "$TMP/ff.$FF_ARCHIVE" "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/$FFMPEG_TAG/$FF.$FF_ARCHIVE"
if [ "$FF_ARCHIVE" = "zip" ]; then
	unzip_members "$TMP/ff.zip" "$TMP" "$FF/bin/ffmpeg$EXT" "$FF/bin/ffprobe$EXT"
else
	tar -xf "$TMP/ff.$FF_ARCHIVE" -C "$TMP" "$FF/bin/ffmpeg$EXT" "$FF/bin/ffprobe$EXT"
fi
mv "$TMP/$FF/bin/ffmpeg$EXT" "$DIR/ffmpeg-$TARGET$EXT"
mv "$TMP/$FF/bin/ffprobe$EXT" "$DIR/ffprobe-$TARGET$EXT"
check "$DIR/ffmpeg-$TARGET$EXT" "$SHA_FFMPEG"
check "$DIR/ffprobe-$TARGET$EXT" "$SHA_FFPROBE"

echo "deno $DENO_VERSION ($TARGET)"
curl -fsSL -o "$TMP/deno.zip" "https://github.com/denoland/deno/releases/download/$DENO_VERSION/deno-$TARGET.zip"
unzip_members "$TMP/deno.zip" "$TMP" "deno$EXT"
mv "$TMP/deno$EXT" "$DIR/deno-$TARGET$EXT"
check "$DIR/deno-$TARGET$EXT" "$SHA_DENO"

chmod +x "$DIR"/*
ls -la "$DIR"
