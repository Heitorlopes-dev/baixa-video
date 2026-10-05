// Tela descartável da Fase 1 (prova de viabilidade no Android). Não vai para a main.
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { FORMATS, type FormatId } from "../lib/ytdlp";

const BASE_ARGS = [
  "--newline",
  "--no-playlist",
  "--no-quiet",
  "-o",
  "%(title)s.%(ext)s",
  "--print",
  "after_move:ARQUIVO::%(filepath)s",
];

type Poll = { lines: string[]; exitCode?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AndroidSpike() {
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  const [log, setLog] = useState<readonly string[]>([]);
  const add = (line: string) => setLog((prev) => [...prev, line]);

  const action = useMutation({
    mutationFn: async (run: () => Promise<void>) => run(),
    onError: (error) => add(`ERRO: ${String(error)}`),
  });

  const simple = (command: string) => () =>
    action.mutate(async () => {
      const t0 = Date.now();
      const result = await invoke(`plugin:ytdlp|${command}`);
      add(`${command} (${Date.now() - t0} ms): ${JSON.stringify(result)}`);
    });

  const download = (format: FormatId) => () =>
    action.mutate(async () => {
      setLog([]);
      const started = await invoke("plugin:ytdlp|start", {
        payload: { id: "spike", url, args: [...BASE_ARGS, ...FORMATS[format].args] },
      });
      add(`start: ${JSON.stringify(started)}`);
      const poll = async (t0: number | null): Promise<void> => {
        await sleep(400);
        const { lines, exitCode } = await invoke<Poll>("plugin:ytdlp|poll");
        const first = t0 ?? (lines[0] ? Number(lines[0].split("|")[0]) : null);
        for (const raw of lines) {
          const [ms, ...rest] = raw.split("|");
          add(`+${((Number(ms) - (first ?? Number(ms))) / 1000).toFixed(1)}s ${rest.join("|")}`);
        }
        if (exitCode === undefined) return poll(first);
        add(`fim: código ${exitCode}`);
      };
      await poll(null);
    });

  return (
    <main className="flex min-h-screen flex-col gap-3 px-4 pb-6 pt-12 text-sm">
      <h1 className="text-lg font-semibold">Fase 1: teste no Android</h1>
      <TextInput value={url} onChange={(e) => setUrl(e.currentTarget.value)} className="min-w-0" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={action.isPending} onClick={simple("init")}>
          1. Iniciar
        </Button>
        <Button variant="secondary" disabled={action.isPending} onClick={simple("version")}>
          Versão
        </Button>
        <Button variant="secondary" disabled={action.isPending} onClick={simple("update")}>
          2. Atualizar yt-dlp
        </Button>
        <Button variant="primary" size="md" disabled={action.isPending} onClick={download("720p")}>
          3. Baixar 720p
        </Button>
        <Button variant="primary" size="md" disabled={action.isPending} onClick={download("mp3")}>
          4. Baixar MP3
        </Button>
        <Button
          variant="danger"
          size="md"
          onClick={() =>
            void invoke("plugin:ytdlp|cancel", { payload: { id: "spike" } }).then((r) =>
              add(`cancel: ${JSON.stringify(r)}`),
            )
          }
        >
          Cancelar
        </Button>
      </div>
      <pre className="min-h-64 select-text overflow-auto whitespace-pre-wrap break-all rounded-md bg-black p-3 font-mono text-xs leading-5 text-green-300">
        {log.length === 0 ? "Toque em 1. Iniciar." : log.join("\n")}
      </pre>
    </main>
  );
}
