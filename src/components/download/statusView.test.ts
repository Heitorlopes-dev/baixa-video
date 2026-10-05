import { describe, expect, test } from "bun:test";
import { type DownloadState, initialState } from "../../lib/download";
import { STATUS_VIEW, barWidth, statusLabel } from "./statusView";

const at = (patch: Partial<DownloadState>): DownloadState => ({ ...initialState, ...patch });

describe("statusLabel", () => {
  test("um rótulo por status, com os textos da tela", () => {
    expect(statusLabel(at({ status: "parado" }))).toBe("");
    expect(statusLabel(at({ status: "convertendo" }))).toBe("Convertendo…");
    expect(statusLabel(at({ status: "concluido" }))).toBe("Concluído");
    expect(statusLabel(at({ status: "erro" }))).toBe("Deu erro. Veja os detalhes.");
    expect(statusLabel(at({ status: "cancelado" }))).toBe("Cancelado");
    expect(statusLabel(at({ status: "atualizando" }))).toBe("Atualizando o yt-dlp…");
  });

  test("baixando mostra a porcentagem arredondada e a parte quando há mais de uma", () => {
    expect(statusLabel(at({ status: "baixando", progress: 45.3 }))).toBe("Baixando… 45%");
    expect(statusLabel(at({ status: "baixando", progress: 20.9, part: { atual: 2, total: 2 } }))).toBe(
      "Baixando (parte 2 de 2)… 21%",
    );
    expect(statusLabel(at({ status: "baixando", progress: 0, part: { atual: 0, total: 2 } }))).toBe("Baixando… 0%");
  });
});

describe("barra", () => {
  test("conversão enche a barra; o resto segue o progresso", () => {
    expect(barWidth(at({ status: "convertendo", progress: 30 }))).toBe(100);
    expect(barWidth(at({ status: "baixando", progress: 30 }))).toBe(30);
  });

  test("erro em vermelho, conversão pulsando", () => {
    expect(STATUS_VIEW.erro.bar).toContain("bg-red-500");
    expect(STATUS_VIEW.convertendo.bar).toContain("animate-pulse");
  });
});
