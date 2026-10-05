// Ciclo de um download (e do "Atualizar yt-dlp") como máquina de estados pura.
// Cada evento vem do processo do yt-dlp ou de um clique; o estado da tela sai
// só daqui, então combinações impossíveis ("concluído" com a barra em 40%)
// não acontecem e tudo é testável com `bun test`, sem abrir o app.
import { parseLine, type YtDlpLine } from "./ytdlp";

/**
 * Regras de cada status, num lugar só: se a tela fica ocupada (campos travados)
 * e se é um download em andamento (mostra Cancelar). O tipo Status sai daqui.
 */
const STATUS_RULES = {
  parado: { busy: false, downloading: false },
  baixando: { busy: true, downloading: true },
  convertendo: { busy: true, downloading: true },
  concluido: { busy: false, downloading: false },
  erro: { busy: false, downloading: false },
  cancelado: { busy: false, downloading: false },
  atualizando: { busy: true, downloading: false },
} as const satisfies Record<string, { busy: boolean; downloading: boolean }>;

export type Status = keyof typeof STATUS_RULES;

export type DownloadState = {
  status: Status;
  /** 0 a 100, da parte que está sendo baixada agora. */
  progress: number;
  /** Vídeo + áudio vêm em duas partes; o rótulo mostra "parte 1 de 2". */
  part: { atual: number; total: number };
  filePath: string | null;
  log: readonly string[];
  logOpen: boolean;
  /** Pediu para cancelar; o status só vira "cancelado" quando o processo termina. */
  cancelling: boolean;
};

export type DownloadEvent =
  | { type: "download-start" }
  | { type: "update-start" }
  /** Linha do stdout do yt-dlp: vai para o log e, num download, move o progresso. */
  | { type: "stdout"; line: string }
  /** Linha só para o log (stderr, o comando executado, avisos). */
  | { type: "log"; line: string }
  /** O arquivo pronto foi publicado num lugar que o usuário vê (Android: Downloads). */
  | { type: "saved"; path: string }
  | { type: "cancel" }
  | { type: "exit"; code: number | null }
  /** O processo nem chegou a rodar, ou a ponte com o Rust falhou. */
  | { type: "fail"; message: string }
  | { type: "toggle-log" };

export const MAX_LOG = 400;

export const initialState: DownloadState = {
  status: "parado",
  progress: 0,
  part: { atual: 0, total: 1 },
  filePath: null,
  log: [],
  logOpen: false,
  cancelling: false,
};

export function isDownloading(state: DownloadState): boolean {
  return STATUS_RULES[state.status].downloading;
}

export function isBusy(state: DownloadState): boolean {
  return STATUS_RULES[state.status].busy;
}

/** Caminho do arquivo pronto para abrir na pasta: só quando o download terminou e o yt-dlp informou onde salvou. */
export function readyFile(state: DownloadState): string | null {
  return state.status === "concluido" ? state.filePath : null;
}

function appendLog(log: readonly string[], line: string): readonly string[] {
  return log.length >= MAX_LOG ? [...log.slice(log.length - MAX_LOG + 1), line] : [...log, line];
}

/** O que uma linha reconhecida do yt-dlp muda num download em andamento. */
function applyLine(state: DownloadState, line: YtDlpLine): DownloadState {
  switch (line.kind) {
    case "formats":
      return { ...state, part: { atual: 0, total: line.count } };
    case "part-start":
      return {
        ...state,
        status: "baixando",
        progress: 0,
        part: { ...state.part, atual: Math.min(state.part.atual + 1, state.part.total) },
      };
    case "convert":
      return { ...state, status: "convertendo" };
    case "progress":
      return { ...state, progress: line.percent };
    case "file":
      return { ...state, filePath: line.path };
  }
}

function finished(state: DownloadState, code: number | null): DownloadState {
  if (state.status === "atualizando") {
    return { ...state, status: code === 0 ? "parado" : "erro" };
  }
  if (!isDownloading(state)) return state;
  if (state.cancelling) return { ...state, status: "cancelado", cancelling: false };
  if (code === 0) return { ...state, status: "concluido", progress: 100 };
  return { ...state, status: "erro", logOpen: true };
}

export function downloadReducer(state: DownloadState, event: DownloadEvent): DownloadState {
  switch (event.type) {
    case "download-start":
      return { ...initialState, status: "baixando", logOpen: state.logOpen };
    case "update-start":
      return { ...initialState, status: "atualizando", logOpen: true };
    case "stdout": {
      const logged = { ...state, log: appendLog(state.log, event.line) };
      const line = isDownloading(state) ? parseLine(event.line) : null;
      return line === null ? logged : applyLine(logged, line);
    }
    case "log":
      return { ...state, log: appendLog(state.log, event.line) };
    case "saved":
      return isDownloading(state) ? { ...state, filePath: event.path } : state;
    case "cancel":
      return isDownloading(state) && !state.cancelling
        ? { ...state, cancelling: true, log: appendLog(state.log, "cancelado pelo usuário") }
        : state;
    case "exit":
      return finished(state, event.code);
    case "fail": {
      const logged = { ...state, log: appendLog(state.log, `erro: ${event.message}`), logOpen: true };
      if (!isBusy(state)) return logged;
      return { ...logged, status: state.cancelling ? "cancelado" : "erro", cancelling: false };
    }
    case "toggle-log":
      return { ...state, logOpen: !state.logOpen };
  }
}
