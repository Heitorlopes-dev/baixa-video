import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { DownloadActions } from "./components/download/DownloadActions";
import { DownloadForm } from "./components/download/DownloadForm";
import { LogPanel } from "./components/download/LogPanel";
import { ProgressBar } from "./components/download/ProgressBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { Button } from "./components/ui/Button";
import { useDownload } from "./hooks/useDownload";
import { useEngine } from "./hooks/usePlatform";
import { useCanUpdateYtDlp } from "./hooks/useUpdater";
import { type FormatId, isValidUrl } from "./lib/ytdlp";

export function App() {
  const [url, setUrl] = useState("");
  const [chosenDir, setChosenDir] = useState<string | null>(null);
  const engine = useEngine();
  const [format, setFormat] = useState<FormatId>("melhor");
  const { state, ready, busy, start, cancel, updateYtDlp, toggleLog } = useDownload(engine);
  const { data: canUpdateYtDlp = true } = useCanUpdateYtDlp();
  const { data: defaultDir = "" } = useQuery({
    queryKey: ["download-dir"],
    queryFn: () => downloadDir(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const dir = chosenDir ?? defaultDir;
  const canStart = ready && !busy && isValidUrl(url) && dir !== "";

  async function chooseDir() {
    const picked = await open({ directory: true, defaultPath: dir || undefined, title: "Salvar em" });
    if (typeof picked === "string") setChosenDir(picked);
  }

  function startDownload() {
    if (canStart) void start({ url, dir, format });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-6 py-6">
      <UpdateBanner disabled={busy} />
      <header>
        <h1 className="text-2xl font-semibold">Baixa Vídeo</h1>
        <p className="text-sm opacity-70">Cole o link, escolha a pasta e o formato, e clique em Baixar.</p>
      </header>

      <DownloadForm
        url={url}
        onUrlChange={setUrl}
        dir={dir}
        onChooseDir={() => void chooseDir()}
        format={format}
        onFormatChange={setFormat}
        disabled={busy}
        onSubmit={startDownload}
      />

      <DownloadActions
        state={state}
        canStart={canStart}
        onStart={startDownload}
        onCancel={() => void cancel()}
        onOpenFolder={(path) => void engine?.open(path)}
        openLabel={engine?.openLabel ?? "Abrir pasta"}
      />

      <ProgressBar state={state} />

      <LogPanel
        log={state.log}
        open={state.logOpen}
        onToggle={toggleLog}
        actions={
          canUpdateYtDlp && (
            <Button variant="link" disabled={busy} onClick={() => void updateYtDlp()}>
              Atualizar yt-dlp
            </Button>
          )
        }
      />
    </main>
  );
}
