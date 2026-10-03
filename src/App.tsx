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
  parseProgress,
  type FormatId,
} from "./lib/ytdlp";

type Status = "parado" | "baixando" | "concluido" | "erro" | "atualizando";

const MAX_LOG = 400;

export function App() {
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");
  const [format, setFormat] = useState<FormatId>("melhor");
  const [status, setStatus] = useState<Status>("parado");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const childRef = useRef<Child | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    downloadDir()
      .then(setDir)
      .catch(() => setDir(""));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  const appendLog = (line: string) =>
    setLog((prev) => (prev.length >= MAX_LOG ? [...prev.slice(1), line] : [...prev, line]));

  const busy = status === "baixando" || status === "atualizando";
  const canStart = !busy && isValidUrl(url) && dir !== "";

  async function chooseDir() {
    const picked = await open({ directory: true, defaultPath: dir || undefined, title: "Salvar em" });
    if (typeof picked === "string") setDir(picked);
  }

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
    childRef.current = await cmd.spawn();
    const code = await exit;
    childRef.current = null;
    return code;
  }

  async function start() {
    if (!canStart) return;
    setStatus("baixando");
    setProgress(0);
    setFilePath(null);
    setLog([]);
    try {
      const binDir = await invoke<string>("bin_dir");
      const args = buildArgs({ url, dir, format, binDir });
      appendLog(`> yt-dlp ${args.join(" ")}`);
      const code = await runSidecar(args, (line) => {
        const pct = parseProgress(line);
        if (pct !== null) setProgress(pct);
        const path = parseFilePath(line);
        if (path !== null) setFilePath(path);
      });
      if (code === 0) {
        setProgress(100);
        setStatus("concluido");
      } else {
        setStatus("erro");
        setShowLog(true);
      }
    } catch (error) {
      appendLog(`erro: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("erro");
      setShowLog(true);
    }
  }

  async function cancel() {
    await childRef.current?.kill();
    setStatus("parado");
    appendLog("cancelado pelo usuário");
  }

  async function updateYtDlp() {
    setStatus("atualizando");
    setLog([]);
    setShowLog(true);
    const code = await runSidecar(["-U"]);
    setStatus(code === 0 ? "parado" : "erro");
  }

  async function openFolder() {
    if (filePath) await revealItemInDir(filePath);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Baixa Vídeo</h1>
        <p className="text-sm opacity-70">Cole o link, escolha a pasta e o formato, e clique em Baixar.</p>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Link do vídeo</span>
        <input
          className="rounded-md border border-neutral-400/50 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
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
          <input
            className="flex-1 rounded-md border border-neutral-400/50 bg-transparent px-3 py-2 opacity-80"
            value={dir}
            readOnly
            placeholder="Escolha uma pasta"
          />
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
          className="rounded-md border border-neutral-400/50 bg-transparent px-3 py-2"
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.currentTarget.value as FormatId)}
        >
          {FORMAT_IDS.map((id) => (
            <option key={id} value={id}>
              {FORMATS[id].label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        {status === "baixando" ? (
          <button
            type="button"
            className="rounded-md bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700"
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
        <span className="ml-auto text-sm opacity-70">{statusLabel(status, progress)}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-neutral-500/20">
        <div
          className={`h-full transition-[width] ${status === "erro" ? "bg-red-500" : "bg-blue-500"}`}
          style={{ width: `${progress}%` }}
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
          <pre className="h-56 select-text overflow-auto rounded-md bg-black p-3 font-mono text-xs leading-5 text-green-300">
            {log.length === 0 ? "Nada ainda." : log.join("\n")}
            <div ref={logEndRef} />
          </pre>
        )}
      </section>
    </main>
  );
}

function statusLabel(status: Status, progress: number): string {
  switch (status) {
    case "parado":
      return "";
    case "baixando":
      return `Baixando… ${progress.toFixed(0)}%`;
    case "concluido":
      return "Concluído";
    case "erro":
      return "Deu erro. Veja os detalhes.";
    case "atualizando":
      return "Atualizando o yt-dlp…";
  }
}
