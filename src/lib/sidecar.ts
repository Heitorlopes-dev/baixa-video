// Adaptador fino entre a tela e o processo do yt-dlp: tudo que toca o Tauri
// (plugin shell e comandos Rust) para rodar ou parar o processo fica aqui.
import { Command, type Child } from "@tauri-apps/plugin-shell";
import { commands } from "../bindings";

export type ProcessHandlers = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

export type RunningProcess = {
  child: Child;
  /** Código de saída, ou null se o processo morreu sem código. */
  exit: Promise<number | null>;
};

/** Pasta do executável do app, onde estão ffmpeg, ffprobe e deno. */
export async function binDir(): Promise<string> {
  const result = await commands.binDir();
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}

export async function spawnYtDlp(args: string[], handlers: ProcessHandlers): Promise<RunningProcess> {
  const cmd = Command.sidecar("binaries/yt-dlp", args);
  cmd.stdout.on("data", handlers.stdout);
  cmd.stderr.on("data", handlers.stderr);
  const exit = new Promise<number | null>((resolve) => {
    cmd.on("close", ({ code }) => resolve(code));
    cmd.on("error", (message) => {
      handlers.stderr(`erro: ${message}`);
      resolve(null);
    });
  });
  const child = await cmd.spawn();
  return { child, exit };
}

/** Encerra o yt-dlp e os filhos dele (ffmpeg). Se o comando Rust falhar, ao menos o yt-dlp morre. */
export async function killProcessTree(child: Child): Promise<void> {
  const result = await commands.killTree(child.pid).catch(() => null);
  if (result === null || result.status === "error") await child.kill().catch(() => undefined);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
