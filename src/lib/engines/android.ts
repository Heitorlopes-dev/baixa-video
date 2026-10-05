// Motor do Android: o plugin Kotlin (youtubedl-android) pela ponte tipada.
// A pasta de destino e os caminhos do ffmpeg e do QuickJS ficam a cargo do Kotlin.
import { Channel } from "@tauri-apps/api/core";
import { type EngineError, type EngineEvent, type SharedText, commands } from "../../bindings";
import { extractUrl } from "../share";
import type { Engine, Job, JobHandlers } from "../engine";
import { coreArgs } from "../ytdlp";

export function engineErrorMessage(error: EngineError): string {
  switch (error.kind) {
    case "unsupported":
      return "este motor não existe nesta plataforma";
    case "bridge":
      return error.message;
  }
}

/** Entrega um evento do canal ao lugar certo. Devolve o código quando o evento é o fim. */
export function routeEvent(event: EngineEvent, handlers: JobHandlers): { exit: number | null } | null {
  switch (event.kind) {
    case "line":
      (event.stream === "stdout" ? handlers.stdout : handlers.log)(event.text);
      return null;
    case "saved":
      handlers.saved(event.uri);
      handlers.log(`salvo em Downloads/BaixaVideo: ${event.name}`);
      return null;
    case "exit":
      return { exit: event.code };
  }
}

const finished = (code: number): Job => ({ exit: Promise.resolve(code), cancel: async () => {} });

/** Promessa com o resolve exposto: o canal precisa resolver o fim de fora do executor. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const androidEngine: Engine = {
  download: async ({ url, format }, handlers) => {
    const id = crypto.randomUUID();
    const done = deferred<number | null>();
    const channel = new Channel<EngineEvent>((event) => {
      const end = routeEvent(event, handlers);
      if (end) done.resolve(end.exit);
    });
    const args = coreArgs(format);
    handlers.log(`> yt-dlp ${args.join(" ")} ${url.trim()}`);
    const started = await commands.engineStart({ id, url: url.trim(), args }, channel);
    if (started.status === "error") throw new Error(engineErrorMessage(started.error));
    return {
      exit: done.promise,
      cancel: async () => {
        await commands.engineCancel(id);
      },
    };
  },

  updateYtDlp: async (handlers) => {
    const result = await commands.engineUpdate();
    if (result.status === "error") {
      handlers.log(`erro: ${engineErrorMessage(result.error)}`);
      return finished(1);
    }
    const { status, version } = result.data;
    handlers.log(
      status === "done" ? `yt-dlp atualizado para ${version}` : `yt-dlp já está na última versão (${version})`,
    );
    return finished(0);
  },

  open: async (uri) => {
    const result = await commands.engineOpen(uri);
    if (result.status === "error") throw new Error(engineErrorMessage(result.error));
  },
  openLabel: "Abrir",
  destination: {
    kind: "managed",
    current: async () => {
      const result = await commands.engineDestination();
      if (result.status === "error") throw new Error(engineErrorMessage(result.error));
      return result.data;
    },
    pick: async () => {
      const result = await commands.enginePickFolder();
      if (result.status === "error") throw new Error(engineErrorMessage(result.error));
      return result.data;
    },
  },

  watchShared: async (onUrl) => {
    const channel = new Channel<SharedText>(({ text }) => {
      const url = extractUrl(text);
      if (url) onUrl(url);
    });
    const result = await commands.engineWatchShared(channel);
    if (result.status === "error") throw new Error(engineErrorMessage(result.error));
  },
};
