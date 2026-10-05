// Depois do `tauri build` de UMA plataforma: copia o instalador assinado e o .sig
// para release/ com nome fixo. O job de publicação junta as plataformas e gera
// o latest.json (scripts/release-manifest.ts).
// Uso: bun scripts/release-files.ts <windows-x86_64|linux-x86_64>
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import conf from "../src-tauri/tauri.conf.json";
import { PLATFORMS, PLATFORM_IDS, assetName, isPlatform } from "../src/lib/release";

const platform = process.argv[2] ?? "";
if (!isPlatform(platform)) throw new Error(`plataforma inválida "${platform}"; use uma de: ${PLATFORM_IDS.join(", ")}`);

const root = join(import.meta.dir, "..");
const { version } = conf;
const { bundleDir, suffix } = PLATFORMS[platform];

// Build nativo e build cruzado (cargo-xwin, --target) saem em pastas diferentes.
const candidates = [
  `src-tauri/target/release/bundle/${bundleDir}`,
  `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/${bundleDir}`,
  `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/${bundleDir}`,
].map((dir) => join(root, dir));

async function findInstaller(): Promise<{ file: string; sig: string }> {
  for (const dir of candidates) {
    const files = await readdir(dir).catch(() => [] as string[]);
    const file = files.find((f) => f.endsWith(suffix(version)));
    if (file && files.includes(`${file}.sig`)) return { file: join(dir, file), sig: join(dir, `${file}.sig`) };
  }
  throw new Error(`instalador *${suffix(version)} com .sig não encontrado em: ${candidates.join(", ")}`);
}

const { file, sig } = await findInstaller();
const out = join(root, "release");
const asset = assetName(platform, version);
await mkdir(out, { recursive: true });
await copyFile(file, join(out, asset));
await copyFile(sig, join(out, `${asset}.sig`));

console.log(`release/${asset}`);
console.log(`release/${asset}.sig`);
