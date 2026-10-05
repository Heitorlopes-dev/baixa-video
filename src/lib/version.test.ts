import { describe, expect, test } from "bun:test";
import { isNewer } from "./version";

describe("isNewer", () => {
  test("compara número a número, não como texto", () => {
    expect(isNewer("0.4.0", "0.3.0")).toBe(true);
    expect(isNewer("0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
  });

  test("igual ou mais antiga não é nova", () => {
    expect(isNewer("0.3.0", "0.3.0")).toBe(false);
    expect(isNewer("0.2.9", "0.3.0")).toBe(false);
  });

  test("aceita o v da tag e versões de tamanhos diferentes", () => {
    expect(isNewer("v0.4.0", "0.3.0")).toBe(true);
    expect(isNewer("0.4", "0.4.0")).toBe(false);
    expect(isNewer("0.4.1", "0.4")).toBe(true);
  });
});
