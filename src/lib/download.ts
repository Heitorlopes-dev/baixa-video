// Ciclo de um download (e do "Atualizar yt-dlp") como máquina de estados pura.
// Cada evento vem do processo do yt-dlp ou de um clique; o estado da tela sai
// só daqui, então combinações impossíveis ("concluído" com a barra em 40%)
// não acontecem e tudo é testável com `bun test`, sem abrir o app.
import { parseFilePath, parseFormatCount, parsePhase, parseProgress } from "./ytdlp";

export type Status = "parado" | "baixando" | "convertendo" | "concluido" | "erro" | "cancelado" | "atualizando";

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
  return state.status === "baixando" || state.status === "convertendo";
}

export function isBusy(state: DownloadState): boolean {
  return isDownloading(state) || state.status === "atualizando";
}

function appendLog(log: readonly string[], line: string): readonly string[] {
  return log.length >= MAX_LOG ? [...log.slice(log.length - MAX_LOG + 1), line] : [...log, line];
}

/** O que uma linha do stdout muda num download em andamento. */
function applyDownloadLine(state: DownloadState, line: string): DownloadState {
  const count = parseFormatCount(line);
  const phase = parsePhase(line);
  const pct = parseProgress(line);
  const path = parseFilePath(line);

  const part = count !== null ? { atual: 0, total: count } : state.part;
  const afterPhase: DownloadState =
    phase === "stream"
      ? { ...state, part: { ...part, atual: Math.min(part.atual + 1, part.total) }, progress: 0, status: "baixando" }
      : phase === "convert"
        ? { ...state, part, status: "convertendo" }
        : { ...state, part };

  return {
    ...afterPhase,
    progress: pct ?? afterPhase.progress,
    filePath: path ?? afterPhase.filePath,
  };
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
      return isDownloading(state) ? applyDownloadLine(logged, event.line) : logged;
    }
    case "log":
      return { ...state, log: appendLog(state.log, event.line) };
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
