import { useReducer, useRef } from "react";
import type { Child } from "@tauri-apps/plugin-shell";
import { downloadReducer, initialState, isBusy, isDownloading } from "../lib/download";
import { binDir, errorMessage, killProcessTree, spawnYtDlp } from "../lib/sidecar";
import { buildArgs, updateArgs, type DownloadInput } from "../lib/ytdlp";

/**
 * Liga a máquina de estados (src/lib/download.ts) ao processo do yt-dlp.
 * O estado da tela vem só do reducer; os refs aqui guardam o processo vivo e o
 * pedido de cancelamento, que precisam ser lidos na hora, fora do ciclo de render.
 */
export function useDownload() {
  const [state, dispatch] = useReducer(downloadReducer, initialState);
  const childRef = useRef<Child | null>(null);
  const cancelRequested = useRef(false);

  async function run(args: string[]): Promise<void> {
    try {
      const { child, exit } = await spawnYtDlp(args, {
        stdout: (line) => dispatch({ type: "stdout", line }),
        stderr: (line) => dispatch({ type: "log", line }),
      });
      childRef.current = child;
      // Cancelar clicado antes de o processo nascer: mata agora.
      if (cancelRequested.current) await killProcessTree(child);
      dispatch({ type: "exit", code: await exit });
    } catch (error) {
      dispatch({ type: "fail", message: errorMessage(error) });
    } finally {
      childRef.current = null;
    }
  }

  async function start(input: Omit<DownloadInput, "binDir">): Promise<void> {
    cancelRequested.current = false;
    dispatch({ type: "download-start" });
    try {
      const args = buildArgs({ ...input, binDir: await binDir() });
      dispatch({ type: "log", line: `> yt-dlp ${args.join(" ")}` });
      await run(args);
    } catch (error) {
      dispatch({ type: "fail", message: errorMessage(error) });
    }
  }

  async function cancel(): Promise<void> {
    cancelRequested.current = true;
    dispatch({ type: "cancel" });
    const child = childRef.current;
    if (child) await killProcessTree(child);
  }

  async function updateYtDlp(): Promise<void> {
    cancelRequested.current = false;
    dispatch({ type: "update-start" });
    await run(updateArgs());
  }

  return {
    state,
    busy: isBusy(state),
    downloading: isDownloading(state),
    start,
    cancel,
    updateYtDlp,
    toggleLog: () => dispatch({ type: "toggle-log" }),
  };
}
