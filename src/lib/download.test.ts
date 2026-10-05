import { describe, expect, test } from "bun:test";
import {
  type DownloadEvent,
  type DownloadState,
  MAX_LOG,
  downloadReducer,
  initialState,
  isBusy,
  isDownloading,
  readyFile,
} from "./download";

const run = (events: DownloadEvent[], from: DownloadState = initialState) => events.reduce(downloadReducer, from);
const out = (line: string): DownloadEvent => ({ type: "stdout", line });

// Saída real do yt-dlp num download em 720p (vídeo + áudio) e num MP3.
const VIDEO_LINES = [
  "[youtube] jNQXAC9IVRw: Downloading webpage",
  "[info] jNQXAC9IVRw: Downloading 1 format(s): 133+140",
  "[download] Destination: /x/Me at the zoo.f133.mp4",
  "[download]  45.3% of  422.93KiB at 1.00MiB/s ETA 00:00",
  "[download] 100% of  422.93KiB in 00:00:00 at 930.45KiB/s",
  "[download] Destination: /x/Me at the zoo.f140.m4a",
  "[download]  20.9% of  302.04KiB at 4.92MiB/s ETA 00:00",
];

describe("download de vídeo", () => {
  test("começa limpo, mas mantém o painel de detalhes como a pessoa deixou", () => {
    const sujo: DownloadState = {
      ...initialState,
      status: "erro",
      progress: 40,
      filePath: "/a.mp4",
      log: ["x"],
      logOpen: true,
    };
    expect(run([{ type: "download-start" }], sujo)).toEqual({ ...initialState, status: "baixando", logOpen: true });
  });

  test("conta as partes e zera o progresso a cada parte nova", () => {
    const s = run([{ type: "download-start" }, ...VIDEO_LINES.map(out)]);
    expect(s.status).toBe("baixando");
    expect(s.part).toEqual({ atual: 2, total: 2 });
    expect(s.progress).toBe(20.9);
    expect(s.log).toHaveLength(VIDEO_LINES.length);
  });

  test("mesclagem vira 'convertendo' e a linha do --print traz o arquivo final", () => {
    const s = run([
      { type: "download-start" },
      ...VIDEO_LINES.map(out),
      out('[Merger] Merging formats into "/x/Me at the zoo.mp4"'),
      out("ARQUIVO::/x/Me at the zoo.mp4"),
    ]);
    expect(s.status).toBe("convertendo");
    expect(s.filePath).toBe("/x/Me at the zoo.mp4");
  });

  test("saída 0 conclui com a barra cheia", () => {
    const s = run([{ type: "download-start" }, ...VIDEO_LINES.map(out), { type: "exit", code: 0 }]);
    expect(s.status).toBe("concluido");
    expect(s.progress).toBe(100);
    expect(isBusy(s)).toBe(false);
  });

  test("saída diferente de 0 é erro e abre o painel de detalhes", () => {
    const s = run([{ type: "download-start" }, out("ERROR: Video unavailable"), { type: "exit", code: 1 }]);
    expect(s.status).toBe("erro");
    expect(s.logOpen).toBe(true);
  });
});

describe("cancelar", () => {
  test("termina como 'cancelado', não como erro, mesmo com código de saída ruim", () => {
    const s = run([
      { type: "download-start" },
      ...VIDEO_LINES.map(out),
      { type: "cancel" },
      { type: "exit", code: null },
    ]);
    expect(s.status).toBe("cancelado");
    expect(s.cancelling).toBe(false);
    expect(s.log.at(-1)).toBe("cancelado pelo usuário");
  });

  test("enquanto o processo não termina, segue baixando com o pedido registrado", () => {
    const s = run([{ type: "download-start" }, { type: "cancel" }]);
    expect(s.status).toBe("baixando");
    expect(s.cancelling).toBe(true);
    expect(isDownloading(s)).toBe(true);
  });

  test("cancelar duas vezes não duplica nada", () => {
    const s = run([{ type: "download-start" }, { type: "cancel" }, { type: "cancel" }]);
    expect(s.log.filter((l) => l === "cancelado pelo usuário")).toHaveLength(1);
  });

  test("falha de processo depois de cancelar também é 'cancelado'", () => {
    const s = run([{ type: "download-start" }, { type: "cancel" }, { type: "fail", message: "processo morreu" }]);
    expect(s.status).toBe("cancelado");
  });

  test("cancelar sem download em andamento é ignorado", () => {
    expect(run([{ type: "cancel" }])).toEqual(initialState);
    const concluido = run([{ type: "download-start" }, { type: "exit", code: 0 }]);
    expect(run([{ type: "cancel" }], concluido)).toEqual(concluido);
  });
});

describe("atualizar o yt-dlp", () => {
  test("abre o painel e não mexe em progresso com a saída do -U", () => {
    const s = run([
      { type: "update-start" },
      out("[download] 100% of 17.00MiB"),
      out("Updated yt-dlp to stable@2026.09.01"),
    ]);
    expect(s.status).toBe("atualizando");
    expect(s.logOpen).toBe(true);
    expect(s.progress).toBe(0);
    expect(isBusy(s)).toBe(true);
    expect(isDownloading(s)).toBe(false);
  });

  test("saída 0 volta a 'parado', outra coisa vira erro", () => {
    expect(run([{ type: "update-start" }, { type: "exit", code: 0 }]).status).toBe("parado");
    expect(run([{ type: "update-start" }, { type: "exit", code: 100 }]).status).toBe("erro");
  });
});

describe("falhas e log", () => {
  test("falha antes de o processo nascer vira erro com a mensagem no log", () => {
    const s = run([{ type: "download-start" }, { type: "fail", message: "sidecar não encontrado" }]);
    expect(s.status).toBe("erro");
    expect(s.log).toEqual(["erro: sidecar não encontrado"]);
    expect(s.logOpen).toBe(true);
  });

  test("saída de processo fora de um download não muda o estado", () => {
    expect(run([{ type: "exit", code: 1 }])).toEqual(initialState);
  });

  test("o log guarda só as últimas MAX_LOG linhas", () => {
    const lines = Array.from({ length: MAX_LOG + 25 }, (_, i): DownloadEvent => ({ type: "log", line: `l${i}` }));
    const s = run(lines);
    expect(s.log).toHaveLength(MAX_LOG);
    expect(s.log[0]).toBe("l25");
    expect(s.log.at(-1)).toBe(`l${MAX_LOG + 24}`);
  });

  test("abrir e fechar o painel", () => {
    expect(run([{ type: "toggle-log" }]).logOpen).toBe(true);
    expect(run([{ type: "toggle-log" }, { type: "toggle-log" }]).logOpen).toBe(false);
  });

  test("nunca altera o estado recebido", () => {
    const antes = run([{ type: "download-start" }, ...VIDEO_LINES.map(out)]);
    const copia = structuredClone(antes);
    run(
      [
        out('[Merger] Merging formats into "a.mp4"'),
        { type: "cancel" },
        { type: "exit", code: 0 },
        { type: "toggle-log" },
      ],
      antes,
    );
    expect(antes).toEqual(copia);
  });
});

describe("readyFile", () => {
  test("só existe arquivo para abrir depois de concluído", () => {
    const comArquivo = run([{ type: "download-start" }, out("ARQUIVO::/x/a.mp4")]);
    expect(readyFile(comArquivo)).toBeNull();
    expect(readyFile(run([{ type: "exit", code: 0 }], comArquivo))).toBe("/x/a.mp4");
    expect(readyFile(run([{ type: "exit", code: 1 }], comArquivo))).toBeNull();
    expect(readyFile(run([{ type: "download-start" }, { type: "exit", code: 0 }]))).toBeNull();
  });
});
