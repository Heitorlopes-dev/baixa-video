import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Command, type Child } from "@tauri-apps/plugin-shell";
import {
  FORMATS,
  FORMAT_IDS,
  buildArgs,
  isValidUrl,
  parseFilePath,
  parseFormatCount,
  parsePhase,
  parseProgress,
  updateArgs,
  type FormatId,
} from "./lib/ytdlp";

type Status = "parado" | "baixando" | "convertendo" | "concluido" | "erro" | "cancelado" | "atualizando";

const MAX_LOG = 400;

const INPUT = "rounded-md border border-neutral-400/50 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100";

export function App() {
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");
  const [format, setFormat] = useState<FormatId>("melhor");
  const [status, setStatus] = useState<Status>("parado");
  const [progress, setProgress] = useState(0);
  const [part, setPart] = useState({ atual: 0, total: 1 });
  const [log, setLog] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const childRef = useRef<Child | null>(null);
  const cancelledRef = useRef(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    downloadDir()
      .then(setDir)
      .catch(() => setDir(""));
  }, []);

  useEffect(() => {
    const pre = logRef.current;
    if (pre) pre.scrollTop = pre.scrollHeight;
  }, [log]);

  const appendLog = (line: string) =>
    setLog((prev) => (prev.length >= MAX_LOG ? [...prev.slice(1), line] : [...prev, line]));

  const busy = status === "baixando" || status === "convertendo" || status === "atualizando";
  const canStart = !busy && isValidUrl(url) && dir !== "";

  async function chooseDir() {
    const picked = await open({ directory: true, defaultPath: dir || undefined, title: "Salvar em" });
    if (typeof picked === "string") setDir(picked);
  }

  /** Roda o yt-dlp e resolve com o código de saída (null se o processo morreu ou falhou ao nascer). */
  async function runSidecar(args: string[], onLine?: (line: string) => void): Promise<number | null> {
    const cmd = Command.sidecar("binaries/yt-dlp", args);
    cmd.stdout.on("data", (line: string) => {
      appendLog(line);
      onLine?.(line);
    });
    cmd.stderr.on("data", (line: string) => appendLog(line));
    const exit = new Promise<number | null>((resolve) => {
      cmd.on("close", ({ code }) => resolve(code));
      cmd.on("error", (message) => {
        appendLog(`erro: ${message}`);
        resolve(null);
      });
    });
    const child = await cmd.spawn();
    childRef.current = child;
    // Cancelar clicado antes do processo existir: mata agora.
    if (cancelledRef.current) await killChild(child);
    const code = await exit;
    childRef.current = null;
    return code;
  }

  async function killChild(child: Child) {
    try {
      await invoke("kill_tree", { pid: child.pid });
    } catch {
      await child.kill().catch(() => undefined);
    }
  }

  function handleLine(line: string) {
    const count = parseFormatCount(line);
    if (count !== null) setPart({ atual: 0, total: count });
    const phase = parsePhase(line);
    if (phase === "stream") {
      setProgress(0);
      setPart((p) => ({ ...p, atual: Math.min(p.atual + 1, p.total) }));
      setStatus("baixando");
    } else if (phase === "convert") {
      setStatus("convertendo");
    }
    const pct = parseProgress(line);
    if (pct !== null) setProgress(pct);
    const path = parseFilePath(line);
    if (path !== null) setFilePath(path);
  }

  async function start() {
    if (!canStart) return;
    cancelledRef.current = false;
    setStatus("baixando");
    setProgress(0);
    setPart({ atual: 0, total: 1 });
    setFilePath(null);
    setLog([]);
    try {
      const binDir = await invoke<string>("bin_dir");
      const args = buildArgs({ url, dir, format, binDir });
      appendLog(`> yt-dlp ${args.join(" ")}`);
      const code = await runSidecar(args, handleLine);
      if (cancelledRef.current) {
        setStatus("cancelado");
      } else if (code === 0) {
        setProgress(100);
        setStatus("concluido");
      } else {
        setStatus("erro");
        setShowLog(true);
      }
    } catch (error) {
      appendLog(`erro: ${error instanceof Error ? error.message : String(error)}`);
      setStatus(cancelledRef.current ? "cancelado" : "erro");
      setShowLog(true);
    }
  }

  async function cancel() {
    cancelledRef.current = true;
    appendLog("cancelado pelo usuário");
    const child = childRef.current;
    if (child) await killChild(child);
    // Sem child ainda: runSidecar mata assim que o processo nascer.
  }

  async function updateYtDlp() {
    cancelledRef.current = false;
    setStatus("atualizando");
    setLog([]);
    setShowLog(true);
    try {
      const code = await runSidecar(updateArgs());
      setStatus(code === 0 ? "parado" : "erro");
    } catch (error) {
      appendLog(`erro: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("erro");
    }
  }

  async function openFolder() {
    if (filePath) await revealItemInDir(filePath);
  }

  const downloading = status === "baixando" || status === "convertendo";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Baixa Vídeo</h1>
        <p className="text-sm opacity-70">Cole o link, escolha a pasta e o formato, e clique em Baixar.</p>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Link do vídeo</span>
        <input
          className={`${INPUT} px-3 py-2 outline-none focus:border-blue-500`}
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void start();
          }}
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Salvar em</span>
        <div className="flex gap-2">
          <input className={`${INPUT} flex-1 px-3 py-2 opacity-80`} value={dir} readOnly placeholder="Escolha uma pasta" />
          <button
            type="button"
            className="rounded-md border border-neutral-400/50 px-3 py-2 hover:bg-neutral-500/10 disabled:opacity-50"
            disabled={busy}
            onClick={() => void chooseDir()}
          >
            Escolher pasta
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Formato</span>
        <select
          className={`${INPUT} px-3 py-2`}
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.currentTarget.value as FormatId)}
        >
          {FORMAT_IDS.map((id) => (
            <option key={id} value={id} className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
              {FORMATS[id].label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        {downloading ? (
          <button
            type="button"
            className="rounded-md bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={cancelledRef.current}
            onClick={() => void cancel()}
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!canStart}
            onClick={() => void start()}
          >
            Baixar
          </button>
        )}
        {status === "concluido" && filePath !== null && (
          <button
            type="button"
            className="rounded-md border border-neutral-400/50 px-4 py-2 hover:bg-neutral-500/10"
            onClick={() => void openFolder()}
          >
            Abrir pasta
          </button>
        )}
        <span className="ml-auto text-sm opacity-70">{statusLabel(status, progress, part)}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-neutral-500/20">
        <div
          className={`h-full transition-[width] ${barClass(status)}`}
          style={{ width: `${status === "convertendo" ? 100 : progress}%` }}
        />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-sm underline opacity-70 hover:opacity-100"
            onClick={() => setShowLog((v) => !v)}
          >
            {showLog ? "Esconder detalhes" : "Mostrar detalhes"}
          </button>
          <button
            type="button"
            className="text-sm underline opacity-70 hover:opacity-100 disabled:opacity-40"
            disabled={busy}
            onClick={() => void updateYtDlp()}
          >
            Atualizar yt-dlp
          </button>
        </div>
        {showLog && (
          <pre
            ref={logRef}
            className="h-56 select-text overflow-auto rounded-md bg-black p-3 font-mono text-xs leading-5 text-green-300"
          >
            {log.length === 0 ? "Nada ainda." : log.join("\n")}
          </pre>
        )}
      </section>
    </main>
  );
}

function barClass(status: Status): string {
  if (status === "erro") return "bg-red-500";
  if (status === "convertendo") return "animate-pulse bg-blue-500";
  return "bg-blue-500";
}

function statusLabel(status: Status, progress: number, part: { atual: number; total: number }): string {
  switch (status) {
    case "parado":
      return "";
    case "baixando": {
      const parte = part.total > 1 && part.atual > 0 ? ` (parte ${part.atual} de ${part.total})` : "";
      return `Baixando${parte}… ${progress.toFixed(0)}%`;
    }
    case "convertendo":
      return "Convertendo…";
    case "concluido":
      return "Concluído";
    case "erro":
      return "Deu erro. Veja os detalhes.";
    case "cancelado":
      return "Cancelado";
    case "atualizando":
      return "Atualizando o yt-dlp…";
  }
}
