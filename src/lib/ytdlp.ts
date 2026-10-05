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

/**
 * Toda chamada ao yt-dlp tem exatamente este número de argumentos.
 * A permissão do sidecar (src-tauri/capabilities/default.json, gerada por
 * scripts/gen-capability.ts a partir daqui) valida argumento por posição e
 * descarta em silêncio o que passar da lista, então chamadas mais curtas são
 * completadas com PAD (uma flag inofensiva que pode repetir).
 */
export const ARGS_LEN = 23;
const PAD = "--no-playlist";

/** Únicas flags que o app passa ao yt-dlp. Qualquer outra (ex.: --exec) é recusada pela permissão. */
export const ALLOWED_FLAGS = [
  "--newline",
  "--no-playlist",
  "--no-quiet",
  "--windows-filenames",
  "--ffmpeg-location",
  "--js-runtimes",
  "-P",
  "-o",
  "--print",
  "-f",
  "-S",
  "--merge-output-format",
  "-x",
  "--audio-format",
  "--audio-quality",
  "-U",
  "--",
] as const;

/** Regex de cada posição: uma das flags acima, ou um valor que não começa com "-". */
export const ARG_VALIDATOR = `^(?:${ALLOWED_FLAGS.join("|")}|[^-].*)$`;

/** Prefixo da linha que o yt-dlp imprime com o caminho final do arquivo. */
const FILE_PREFIX = "ARQUIVO::";

export type DownloadInput = {
  url: string;
  dir: string;
  format: FormatId;
  /** Pasta onde estão ffmpeg, ffprobe e deno (a mesma do executável do app). */
  binDir: string;
};

function padded(args: string[], length: number): string[] {
  if (args.length > length) throw new Error(`argumentos demais: ${args.length} > ${length}`);
  return [...args, ...Array<string>(length - args.length).fill(PAD)];
}

/** O preenchimento fica antes de `--`: depois dele o yt-dlp trata tudo como URL. */
export function buildArgs({ url, dir, format, binDir }: DownloadInput): string[] {
  const head = [
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
  ];
  return [...padded(head, ARGS_LEN - 2), "--", url.trim()];
}

/** Argumentos de "Atualizar yt-dlp": o próprio binário se substitui. */
export function updateArgs(): string[] {
  return padded(["-U"], ARGS_LEN);
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

const FORMATS_LINE = /Downloading \d+ format\(s\): (\S+)/;

/** Quantas partes serão baixadas (vídeo+áudio = 2), lido da linha "[info] ... format(s): 133+140". */
export function parseFormatCount(line: string): number | null {
  const match = FORMATS_LINE.exec(line);
  return match ? match[1].split("+").length : null;
}

const CONVERT_LINE = /^\[(Merger|ExtractAudio|VideoConvertor|VideoRemuxer|Fixup\w+)\]/;

export type Phase = "stream" | "convert";

/** "stream" quando começa o download de mais uma parte; "convert" quando o ffmpeg assume. */
export function parsePhase(line: string): Phase | null {
  if (line.startsWith("[download] Destination:")) return "stream";
  if (CONVERT_LINE.test(line)) return "convert";
  return null;
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
