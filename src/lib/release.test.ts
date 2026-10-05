import { describe, expect, test } from "bun:test";
import conf from "../../src-tauri/tauri.conf.json";
import { PLATFORM_IDS, androidAssetName, assetName, isPlatform, tagMatchesVersion, updaterManifest } from "./release";

describe("updaterManifest", () => {
  const m = updaterManifest({
    version: "0.3.0",
    repo: "Heitorlopes-dev/baixa-video",
    signatures: { "windows-x86_64": "  sig-win\n", "linux-x86_64": "sig-linux\n" },
    pubDate: "2026-10-05T12:00:00Z",
  });

  test("tem a versão, a data e uma entrada por plataforma publicada", () => {
    expect(m.version).toBe("0.3.0");
    expect(m.pub_date).toBe("2026-10-05T12:00:00Z");
    expect(Object.keys(m.platforms).sort()).toEqual(["linux-x86_64", "windows-x86_64"]);
  });

  test("cada plataforma aponta para o seu instalador na Release da mesma versão, com a assinatura limpa", () => {
    expect(m.platforms["windows-x86_64"]).toEqual({
      signature: "sig-win",
      url: "https://github.com/Heitorlopes-dev/baixa-video/releases/download/v0.3.0/Baixa-Video_0.3.0_x64-setup.exe",
    });
    expect(m.platforms["linux-x86_64"]).toEqual({
      signature: "sig-linux",
      url: "https://github.com/Heitorlopes-dev/baixa-video/releases/download/v0.3.0/Baixa-Video_0.3.0_amd64.AppImage",
    });
  });

  test("nenhum nome de instalador tem espaço", () => {
    for (const p of PLATFORM_IDS) expect(assetName(p, "1.0.0")).not.toContain(" ");
    expect(androidAssetName("1.0.0")).not.toContain(" ");
  });

  test("o app Android acha o APK da mesma versão em android.url, fora de platforms", () => {
    expect(m.android.url).toBe(
      "https://github.com/Heitorlopes-dev/baixa-video/releases/download/v0.3.0/Baixa-Video_0.3.0_arm64.apk",
    );
    expect(Object.keys(m.platforms)).not.toContain("android");
  });
});

describe("isPlatform", () => {
  test("aceita só as plataformas publicadas", () => {
    expect(isPlatform("linux-x86_64")).toBe(true);
    expect(isPlatform("windows-x86_64")).toBe(true);
    expect(isPlatform("darwin-aarch64")).toBe(false);
    expect(isPlatform("toString")).toBe(false);
  });
});

describe("tagMatchesVersion", () => {
  test("a tag precisa ser v + versão do tauri.conf.json", () => {
    expect(tagMatchesVersion("v0.2.0", "0.2.0")).toBe(true);
    expect(tagMatchesVersion("0.2.0", "0.2.0")).toBe(false);
    expect(tagMatchesVersion("v0.2.1", "0.2.0")).toBe(false);
  });
});

describe("configuração do bundle e do updater (tauri.conf.json)", () => {
  test("gera instalador Windows e AppImage, com os artefatos assinados", () => {
    expect(conf.bundle.targets).toEqual(["nsis", "appimage"]);
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
  });

  test("consulta o latest.json da última Release deste repositório", () => {
    expect(conf.plugins.updater.endpoints).toEqual([
      "https://github.com/Heitorlopes-dev/baixa-video/releases/latest/download/latest.json",
    ]);
    expect(conf.plugins.updater.pubkey.length).toBeGreaterThan(50);
  });
});
