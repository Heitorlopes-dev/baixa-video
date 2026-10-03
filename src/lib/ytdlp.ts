// Funções puras em volta do yt-dlp: montagem de argumentos e leitura da saída.
// Sem acesso ao Tauri aqui, para dar para testar com `bun test`.

export const FORMATS = {
  melhor: {
    label: "Vídeo na melhor qualidade",
    args: ["-f", "bv*+ba/b", "-S", "res,vcodec:h264,acodec:aac", "--merge-output-format", "mp4"],
  },
  "1080p": {
    label: "Vídeo até 1080p",
    args: ["-f", "bv*+ba/b", "-S", "res:1080,vcodec:h264,acodec:aac", "--merge-output-format", "mp4"],
  },
  "720p": {
    label: "Vídeo até 720p",
    args: ["-f", "bv*+ba/b", "-S", "res:720,vcodec:h264,acodec:aac", "--merge-output-format", "mp4"],
  },
  mp3: {
    label: "Só o áudio (MP3)",
    args: ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0"],
  },
} as const;

export type FormatId = keyof typeof FORMATS;

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

/** Prefixo da linha que o yt-dlp imprime com o caminho final do arquivo. */
const FILE_PREFIX = "ARQUIVO::";

export type DownloadInput = {
  url: string;
  dir: string;
  format: FormatId;
  /** Pasta onde estão ffmpeg, ffprobe e deno (a mesma do executável do app). */
  binDir: string;
};

export function buildArgs({ url, dir, format, binDir }: DownloadInput): string[] {
  return [
    "--newline",
    "--no-playlist",
    "--no-quiet",
    "--windows-filenames",
    "--ffmpeg-location",
    binDir,
    "--js-runtimes",
    `deno:${binDir}`,
    "-P",
    dir,
    "-o",
    "%(title)s.%(ext)s",
    "--print",
    `after_move:${FILE_PREFIX}%(filepath)s`,
    ...FORMATS[format].args,
    "--",
    url.trim(),
  ];
}

const PROGRESS = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/;

/** Percentual de uma linha de progresso, ou null se a linha não for de progresso. */
export function parseProgress(line: string): number | null {
  const match = PROGRESS.exec(line);
  if (!match) return null;
  return Math.min(100, Number(match[1]));
}

/** Caminho final do arquivo, se a linha for a que o `--print` emite. */
export function parseFilePath(line: string): string | null {
  const trimmed = line.trim();
  return trimmed.startsWith(FILE_PREFIX) ? trimmed.slice(FILE_PREFIX.length) : null;
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
