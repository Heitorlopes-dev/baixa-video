import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FORMATS, FORMAT_IDS, isValidUrl, type FormatId } from "./lib/ytdlp";
import { STATUS_VIEW, barWidth, statusLabel } from "./components/download/statusView";
import { UpdateBanner } from "./UpdateBanner";
import { useCanUpdateYtDlp } from "./hooks/useUpdater";
import { useDownload } from "./hooks/useDownload";

const INPUT =
  "rounded-md border border-neutral-400/50 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100";

export function App() {
  const [url, setUrl] = useState("");
  const [chosenDir, setChosenDir] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatId>("melhor");
  const { state, busy, downloading, start, cancel, updateYtDlp, toggleLog } = useDownload();
  const { data: canUpdateYtDlp = true } = useCanUpdateYtDlp();
  const { data: defaultDir = "" } = useQuery({
    queryKey: ["download-dir"],
    queryFn: () => downloadDir(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const logRef = useRef<HTMLPreElement>(null);

  const dir = chosenDir ?? defaultDir;
  const canStart = !busy && isValidUrl(url) && dir !== "";

  // Sincroniza o DOM: o painel de detalhes acompanha a última linha.
  useEffect(() => {
    const pre = logRef.current;
    if (pre && state.log.length > 0) pre.scrollTop = pre.scrollHeight;
  }, [state.log]);

  async function chooseDir() {
    const picked = await open({ directory: true, defaultPath: dir || undefined, title: "Salvar em" });
    if (typeof picked === "string") setChosenDir(picked);
  }

  function startDownload() {
    if (canStart) void start({ url, dir, format });
  }

  async function openFolder() {
    if (state.filePath) await revealItemInDir(state.filePath);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-6 py-6">
      <UpdateBanner disabled={busy} />
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
            if (e.key === "Enter") startDownload();
          }}
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Salvar em</span>
        <div className="flex gap-2">
          <input
            className={`${INPUT} flex-1 px-3 py-2 opacity-80`}
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
            disabled={state.cancelling}
            onClick={() => void cancel()}
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!canStart}
            onClick={startDownload}
          >
            Baixar
          </button>
        )}
        {state.status === "concluido" && state.filePath !== null && (
          <button
            type="button"
            className="rounded-md border border-neutral-400/50 px-4 py-2 hover:bg-neutral-500/10"
            onClick={() => void openFolder()}
          >
            Abrir pasta
          </button>
        )}
        <span className="ml-auto text-sm opacity-70">{statusLabel(state)}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-neutral-500/20">
        <div
          className={`h-full transition-[width] ${STATUS_VIEW[state.status].bar}`}
          style={{ width: `${barWidth(state)}%` }}
        />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button type="button" className="text-sm underline opacity-70 hover:opacity-100" onClick={toggleLog}>
            {state.logOpen ? "Esconder detalhes" : "Mostrar detalhes"}
          </button>
          {canUpdateYtDlp && (
            <button
              type="button"
              className="text-sm underline opacity-70 hover:opacity-100 disabled:opacity-40"
              disabled={busy}
              onClick={() => void updateYtDlp()}
            >
              Atualizar yt-dlp
            </button>
          )}
        </div>
        {state.logOpen && (
          <pre
            ref={logRef}
            className="h-56 select-text overflow-auto rounded-md bg-black p-3 font-mono text-xs leading-5 text-green-300"
          >
            {state.log.length === 0 ? "Nada ainda." : state.log.join("\n")}
          </pre>
        )}
      </section>
    </main>
  );
}
