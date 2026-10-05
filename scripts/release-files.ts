// Depois do `tauri build`: copia o instalador assinado para release/ com nome fixo
// e escreve release/latest.json, que o app instalado consulta para se atualizar.
// Uso: bun scripts/release-files.ts [dono/repositorio]   (no CI, vem de GITHUB_REPOSITORY)
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import conf from "../src-tauri/tauri.conf.json";
import { assetName, tagMatchesVersion, updaterManifest } from "../src/lib/release";

const root = join(import.meta.dir, "..");
const repo = process.argv[2] ?? process.env.GITHUB_REPOSITORY;
const { version } = conf;

if (!repo) throw new Error("informe dono/repositorio (ou rode no GitHub Actions)");

const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag !== undefined && !tagMatchesVersion(tag, version)) {
  throw new Error(`a tag ${tag} não bate com a versão ${version} do tauri.conf.json: suba a versão antes de criar a tag`);
}

// Build nativo no Windows e build cruzado no Linux (cargo-xwin) saem em pastas diferentes.
const candidates = [
  "src-tauri/target/release/bundle/nsis",
  "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis",
].map((dir) => join(root, dir));

async function findInstaller(): Promise<{ exe: string; sig: string }> {
  const suffix = `_${version}_x64-setup.exe`;
  for (const dir of candidates) {
    const files = await readdir(dir).catch(() => [] as string[]);
    const exe = files.find((f) => f.endsWith(suffix));
    if (exe && files.includes(`${exe}.sig`)) return { exe: join(dir, exe), sig: join(dir, `${exe}.sig`) };
  }
  throw new Error(`instalador ${suffix} com .sig não encontrado em: ${candidates.join(", ")}`);
}

const { exe, sig } = await findInstaller();
const out = join(root, "release");
await mkdir(out, { recursive: true });
await copyFile(exe, join(out, assetName(version)));

const manifest = updaterManifest({
  version,
  repo,
  signature: await Bun.file(sig).text(),
  pubDate: new Date().toISOString(),
});
await Bun.write(join(out, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`release/${assetName(version)}`);
console.log("release/latest.json");
