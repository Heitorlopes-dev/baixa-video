// Arquivo de versão (latest.json) que o app instalado consulta para se atualizar.
// Puro, para testar com `bun test`; quem lê o disco são scripts/release-files.ts
// (um por plataforma, em cada job) e scripts/release-manifest.ts (junta tudo).

/**
 * Plataformas publicadas. A chave é a que o plugin de atualização do Tauri procura;
 * `bundleDir` e `suffix` acham o instalador que o `tauri build` gerou;
 * `asset` é o nome fixo, sem espaço, com que ele vai para a Release.
 */
export const PLATFORMS = {
  "windows-x86_64": {
    bundleDir: "nsis",
    suffix: (version: string) => `_${version}_x64-setup.exe`,
    asset: (version: string) => `Baixa-Video_${version}_x64-setup.exe`,
  },
  "linux-x86_64": {
    bundleDir: "appimage",
    suffix: (version: string) => `_${version}_amd64.AppImage`,
    asset: (version: string) => `Baixa-Video_${version}_amd64.AppImage`,
  },
} as const;

export type Platform = keyof typeof PLATFORMS;

export const PLATFORM_IDS = Object.keys(PLATFORMS) as Platform[];

export function isPlatform(value: string): value is Platform {
  return Object.hasOwn(PLATFORMS, value);
}

export function assetName(platform: Platform, version: string): string {
  return PLATFORMS[platform].asset(version);
}

/** APK do Android (só arm64). Não usa o atualizador do Tauri, por isso fica fora de `platforms`. */
export function androidAssetName(version: string): string {
  return `Baixa-Video_${version}_arm64.apk`;
}

export function tagMatchesVersion(tag: string, version: string): boolean {
  return tag === `v${version}`;
}

export type ManifestInput = {
  version: string;
  /** "dono/repositorio" no GitHub. */
  repo: string;
  /** Conteúdo do .sig de cada instalador, gerado pelo build assinado. */
  signatures: Record<Platform, string>;
  pubDate: string;
  notes?: string;
};

export function updaterManifest({ version, repo, signatures, pubDate, notes = "" }: ManifestInput) {
  const platforms = Object.fromEntries(
    PLATFORM_IDS.map((platform) => [
      platform,
      {
        signature: signatures[platform].trim(),
        url: `https://github.com/${repo}/releases/download/v${version}/${assetName(platform, version)}`,
      },
    ]),
  ) as Record<Platform, { signature: string; url: string }>;
  // O app Android lê `android.url` (o atualizador do desktop ignora campos que não conhece).
  const android = { url: `https://github.com/${repo}/releases/download/v${version}/${androidAssetName(version)}` };
  return { version, notes, pub_date: pubDate, platforms, android };
}
