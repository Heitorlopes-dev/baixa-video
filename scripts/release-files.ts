// Depois do `tauri build` de UMA plataforma: copia o instalador assinado e o .sig
// para release/ com nome fixo. O job de publicação junta as plataformas e gera
// o latest.json (scripts/release-manifest.ts).
// Uso: bun scripts/release-files.ts <windows-x86_64|linux-x86_64>
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import conf from "../src-tauri/tauri.conf.json";
import { PLATFORMS, PLATFORM_IDS, androidAssetName, assetName, isPlatform } from "../src/lib/release";

const platform = process.argv[2] ?? "";
const root = join(import.meta.dir, "..");
const { version } = conf;
const out = join(root, "release");

// Android: só o APK assinado (o Android verifica a assinatura sozinho; não há .sig).
if (platform === "android-aarch64") {
  const dir = join(root, "src-tauri/gen/android/app/build/outputs/apk/universal/release");
  const apk = (await readdir(dir)).find((f) => f.endsWith(".apk"));
  if (!apk) throw new Error(`APK de release não encontrado em ${dir}`);
  if (apk.includes("unsigned"))
    throw new Error(`o APK ${apk} não está assinado: confira os secrets ANDROID_KEYSTORE_*`);
  await mkdir(out, { recursive: true });
  await copyFile(join(dir, apk), join(out, androidAssetName(version)));
  console.log(`release/${androidAssetName(version)}`);
  process.exit(0);
}

if (!isPlatform(platform)) {
  throw new Error(`plataforma inválida "${platform}"; use android-aarch64 ou uma de: ${PLATFORM_IDS.join(", ")}`);
}
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
const asset = assetName(platform, version);
await mkdir(out, { recursive: true });
await copyFile(file, join(out, asset));
await copyFile(sig, join(out, `${asset}.sig`));

console.log(`release/${asset}`);
console.log(`release/${asset}.sig`);
