import { describe, expect, test } from "bun:test";
import type { EngineEvent } from "../../bindings";
import type { JobHandlers } from "../engine";
import { engineErrorMessage, routeEvent } from "./android";

function collect() {
  const seen: { stdout: string[]; log: string[] } = { stdout: [], log: [] };
  const handlers: JobHandlers = { stdout: (l) => seen.stdout.push(l), log: (l) => seen.log.push(l) };
  return { seen, handlers };
}

describe("routeEvent", () => {
  test("linha da saída padrão vai para o progresso; de erro, só para o log", () => {
    const { seen, handlers } = collect();
    expect(routeEvent({ kind: "line", stream: "stdout", text: "[download]  45.3% of 1MiB" }, handlers)).toBeNull();
    expect(routeEvent({ kind: "line", stream: "stderr", text: "ERROR: indisponível" }, handlers)).toBeNull();
    expect(seen).toEqual({ stdout: ["[download]  45.3% of 1MiB"], log: ["ERROR: indisponível"] });
  });

  test("o fim devolve o código, inclusive nulo (cancelado)", () => {
    const { seen, handlers } = collect();
    const events: EngineEvent[] = [
      { kind: "exit", code: 0 },
      { kind: "exit", code: 1 },
      { kind: "exit", code: null },
    ];
    expect(events.map((e) => routeEvent(e, handlers))).toEqual([{ exit: 0 }, { exit: 1 }, { exit: null }]);
    expect(seen).toEqual({ stdout: [], log: [] });
  });
});

describe("engineErrorMessage", () => {
  test("um texto por tipo de erro", () => {
    expect(engineErrorMessage({ kind: "unsupported" })).toBe("este motor não existe nesta plataforma");
    expect(engineErrorMessage({ kind: "bridge", message: "plugin do yt-dlp não registrado" })).toBe(
      "plugin do yt-dlp não registrado",
    );
  });
});
