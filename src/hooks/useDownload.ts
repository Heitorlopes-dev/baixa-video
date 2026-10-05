import { useReducer, useRef } from "react";
import { downloadReducer, initialState, isBusy, isDownloading } from "../lib/download";
import type { DownloadInput, Engine, Job, JobHandlers } from "../lib/engine";
import { errorMessage } from "../lib/sidecar";

/**
 * Liga a máquina de estados (src/lib/download.ts) ao motor da plataforma.
 * O estado da tela vem só do reducer; os refs guardam o trabalho em andamento e o
 * pedido de cancelamento, que precisam ser lidos na hora, fora do ciclo de render.
 */
export function useDownload(engine: Engine | undefined) {
  const [state, dispatch] = useReducer(downloadReducer, initialState);
  const jobRef = useRef<Job | null>(null);
  const cancelRequested = useRef(false);

  const handlers: JobHandlers = {
    stdout: (line) => dispatch({ type: "stdout", line }),
    log: (line) => dispatch({ type: "log", line }),
    saved: (path) => dispatch({ type: "saved", path }),
  };

  async function run(startJob: (h: JobHandlers) => Promise<Job>): Promise<void> {
    try {
      const job = await startJob(handlers);
      jobRef.current = job;
      // Cancelar clicado antes de o trabalho começar: cancela agora.
      if (cancelRequested.current) await job.cancel();
      dispatch({ type: "exit", code: await job.exit });
    } catch (error) {
      dispatch({ type: "fail", message: errorMessage(error) });
    } finally {
      jobRef.current = null;
    }
  }

  async function start(input: DownloadInput): Promise<void> {
    if (!engine) return;
    cancelRequested.current = false;
    dispatch({ type: "download-start" });
    await run((h) => engine.download(input, h));
  }

  async function cancel(): Promise<void> {
    cancelRequested.current = true;
    dispatch({ type: "cancel" });
    await jobRef.current?.cancel();
  }

  async function updateYtDlp(): Promise<void> {
    if (!engine) return;
    cancelRequested.current = false;
    dispatch({ type: "update-start" });
    await run((h) => engine.updateYtDlp(h));
  }

  return {
    state,
    ready: engine !== undefined,
    busy: isBusy(state),
    downloading: isDownloading(state),
    start,
    cancel,
    updateYtDlp,
    toggleLog: () => dispatch({ type: "toggle-log" }),
  };
}
