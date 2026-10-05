// Arquivo de versão (latest.json) que o app instalado consulta para se atualizar.
// Puro, para testar com `bun test`; quem lê o disco é scripts/release-files.ts.

/** Chave de plataforma que o plugin de atualização do Tauri procura no Windows 64 bits. */
export const PLATFORM = "windows-x86_64";

/** Nome fixo do instalador na Release. Sem espaço, para a URL não depender de como o GitHub renomeia. */
export function assetName(version: string): string {
  return `Baixa-Video_${version}_x64-setup.exe`;
}

export function tagMatchesVersion(tag: string, version: string): boolean {
  return tag === `v${version}`;
}

export type ManifestInput = {
  version: string;
  /** "dono/repositorio" no GitHub. */
  repo: string;
  /** Conteúdo do .sig que o build gera ao lado do instalador. */
  signature: string;
  pubDate: string;
  notes?: string;
};

export function updaterManifest({ version, repo, signature, pubDate, notes = "" }: ManifestInput) {
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      [PLATFORM]: {
        signature: signature.trim(),
        url: `https://github.com/${repo}/releases/download/v${version}/${assetName(version)}`,
      },
    },
  };
}
