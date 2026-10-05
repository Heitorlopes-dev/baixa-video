import { describe, expect, test } from "bun:test";
import conf from "../../src-tauri/tauri.conf.json";
import { PLATFORM, assetName, tagMatchesVersion, updaterManifest } from "./release";

describe("updaterManifest", () => {
  test("aponta para o instalador da Release da mesma versão, com a assinatura limpa", () => {
    const m = updaterManifest({
      version: "0.2.0",
      repo: "Heitorlopes-dev/baixa-video",
      signature: "  assinatura-base64\n",
      pubDate: "2026-10-05T12:00:00Z",
    });
    expect(m.version).toBe("0.2.0");
    expect(m.pub_date).toBe("2026-10-05T12:00:00Z");
    expect(m.platforms[PLATFORM].signature).toBe("assinatura-base64");
    expect(m.platforms[PLATFORM].url).toBe(
      "https://github.com/Heitorlopes-dev/baixa-video/releases/download/v0.2.0/Baixa-Video_0.2.0_x64-setup.exe",
    );
  });

  test("o nome do instalador não tem espaço", () => {
    expect(assetName("1.0.0")).not.toContain(" ");
  });
});

describe("tagMatchesVersion", () => {
  test("a tag precisa ser v + versão do tauri.conf.json", () => {
    expect(tagMatchesVersion("v0.2.0", "0.2.0")).toBe(true);
    expect(tagMatchesVersion("0.2.0", "0.2.0")).toBe(false);
    expect(tagMatchesVersion("v0.2.1", "0.2.0")).toBe(false);
  });
});

describe("configuração do updater (tauri.conf.json)", () => {
  test("gera os artefatos assinados e consulta o latest.json da última Release deste repositório", () => {
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
    expect(conf.plugins.updater.endpoints).toEqual([
      "https://github.com/Heitorlopes-dev/baixa-video/releases/latest/download/latest.json",
    ]);
    expect(conf.plugins.updater.pubkey.length).toBeGreaterThan(50);
  });
});
