// O que a tela precisa de um motor de download, em qualquer plataforma.
// Desktop: yt-dlp como sidecar (engines/desktop.ts). Android: plugin Kotlin pela
// ponte tipada (engines/android.ts). O gancho useDownload só conhece esta interface.
import type { FormatId } from "./ytdlp";

export type JobHandlers = {
  /** Linha da saída padrão do yt-dlp: alimenta o progresso. */
  stdout: (line: string) => void;
  /** Linha só para o painel de detalhes: stderr, comando executado, avisos. */
  log: (line: string) => void;
  /** O arquivo pronto foi publicado num lugar que o usuário vê (só o Android avisa). */
  saved: (path: string) => void;
};

export type Job = {
  /** Código de saída; null quando o processo não terminou sozinho (cancelado ou morto). */
  exit: Promise<number | null>;
  cancel: () => Promise<void>;
};

export type DownloadInput = { url: string; dir: string; format: FormatId };

export type Engine = {
  /** Começa a baixar. Resolve quando já dá para cancelar; o resto chega pelos handlers. */
  download: (input: DownloadInput, handlers: JobHandlers) => Promise<Job>;
  updateYtDlp: (handlers: JobHandlers) => Promise<Job>;
  /** Abre o resultado: no desktop mostra na pasta; no Android abre no app escolhido. */
  open: (path: string) => Promise<void>;
  openLabel: string;
};
