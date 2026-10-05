// Junta as plataformas em release/latest.json, que o app instalado consulta.
// Exige o instalador e o .sig de todas as plataformas publicadas: um latest.json
// sem uma delas deixaria quem usa aquela plataforma sem atualização.
// Uso: bun scripts/release-manifest.ts [dono/repositorio]   (no CI, vem de GITHUB_REPOSITORY)
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import conf from "../src-tauri/tauri.conf.json";
import { PLATFORM_IDS, type Platform, assetName, tagMatchesVersion, updaterManifest } from "../src/lib/release";

const root = join(import.meta.dir, "..");
const out = join(root, "release");
const repo = process.argv[2] ?? process.env.GITHUB_REPOSITORY;
const { version } = conf;

if (!repo) throw new Error("informe dono/repositorio (ou rode no GitHub Actions)");

const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag !== undefined && !tagMatchesVersion(tag, version)) {
  throw new Error(
    `a tag ${tag} não bate com a versão ${version} do tauri.conf.json: suba a versão antes de criar a tag`,
  );
}

const files = await readdir(out);
const missing = PLATFORM_IDS.flatMap((p) => {
  const asset = assetName(p, version);
  return [asset, `${asset}.sig`].filter((f) => !files.includes(f));
});
if (missing.length > 0) throw new Error(`faltando em release/: ${missing.join(", ")}`);

const entries = await Promise.all(
  PLATFORM_IDS.map(async (p) => [p, await Bun.file(join(out, `${assetName(p, version)}.sig`)).text()] as const),
);
const signatures = Object.fromEntries(entries) as Record<Platform, string>;

const manifest = updaterManifest({ version, repo, signatures, pubDate: new Date().toISOString() });
await Bun.write(join(out, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// As assinaturas já estão dentro do latest.json; a Release fica só com instaladores e o manifesto.
await Promise.all(PLATFORM_IDS.map((p) => rm(join(out, `${assetName(p, version)}.sig`))));

console.log(`release/latest.json com ${PLATFORM_IDS.join(" e ")}`);
