import { describe, expect, test } from "bun:test";
import { extractUrl } from "./share";

describe("extractUrl", () => {
  test("link puro, como o YouTube e o Instagram compartilham", () => {
    expect(extractUrl("https://youtu.be/jNQXAC9IVRw?si=abc")).toBe("https://youtu.be/jNQXAC9IVRw?si=abc");
    expect(extractUrl("https://www.instagram.com/reel/XYZ/?igsh=1")).toBe("https://www.instagram.com/reel/XYZ/?igsh=1");
  });

  test("link no meio de uma frase, sem a pontuação colada no fim", () => {
    expect(extractUrl("Olha este vídeo: https://youtu.be/jNQXAC9IVRw?si=abc")).toBe(
      "https://youtu.be/jNQXAC9IVRw?si=abc",
    );
    expect(extractUrl("Vê isso (https://vm.tiktok.com/ZM123/).")).toBe("https://vm.tiktok.com/ZM123/");
    expect(extractUrl("primeiro https://a.com/x e depois https://b.com/y")).toBe("https://a.com/x");
  });

  test("sem link: nada", () => {
    expect(extractUrl("sem link aqui")).toBeNull();
    expect(extractUrl("")).toBeNull();
    expect(extractUrl("ftp://arquivo.com/a")).toBeNull();
  });
});
