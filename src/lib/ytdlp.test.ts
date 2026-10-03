import { describe, expect, test } from "bun:test";
import { buildArgs, isValidUrl, parseFilePath, parseProgress } from "./ytdlp";

describe("buildArgs", () => {
  test("vídeo: baixa para a pasta, em mp4, com o caminho final impresso", () => {
    const args = buildArgs({
      url: " https://youtu.be/abc ",
      dir: "C:\\Users\\x\\Videos",
      format: "720p",
      binDir: "C:\\app",
    });
    expect(args).toContain("--no-playlist");
    expect(args[args.indexOf("--ffmpeg-location") + 1]).toBe("C:\\app");
    expect(args[args.indexOf("--js-runtimes") + 1]).toBe("deno:C:\\app");
    expect(args.slice(args.indexOf("-P"), args.indexOf("-P") + 2)).toEqual(["-P", "C:\\Users\\x\\Videos"]);
    expect(args).toContain("--merge-output-format");
    expect(args).toContain("res:720,vcodec:h264,acodec:aac");
    expect(args.at(-2)).toBe("--");
    expect(args.at(-1)).toBe("https://youtu.be/abc");
    expect(args[args.indexOf("--print") + 1]).toBe("after_move:ARQUIVO::%(filepath)s");
  });

  test("mp3: extrai áudio e não pede merge", () => {
    const args = buildArgs({ url: "https://x.y/z", dir: "/tmp", format: "mp3", binDir: "/app" });
    expect(args).toContain("-x");
    expect(args).toContain("mp3");
    expect(args).not.toContain("--merge-output-format");
  });
});

describe("parseProgress", () => {
  test("lê o percentual da linha de download", () => {
    expect(parseProgress("[download]  45.3% of  120.00MiB at    5.00MiB/s ETA 00:15")).toBe(45.3);
    expect(parseProgress("[download] 100% of 120.00MiB in 00:30")).toBe(100);
  });

  test("ignora outras linhas", () => {
    expect(parseProgress("[youtube] abc: Downloading webpage")).toBeNull();
    expect(parseProgress("[Merger] Merging formats into \"a.mp4\"")).toBeNull();
  });
});

describe("parseFilePath", () => {
  test("reconhece a linha do --print", () => {
    expect(parseFilePath("ARQUIVO::C:\\Videos\\Título do vídeo.mp4\r")).toBe("C:\\Videos\\Título do vídeo.mp4");
    expect(parseFilePath("[download] Destination: a.mp4")).toBeNull();
  });
});

describe("isValidUrl", () => {
  test("aceita http(s) e recusa o resto", () => {
    expect(isValidUrl("https://www.youtube.com/watch?v=1")).toBe(true);
    expect(isValidUrl(" http://x.y ")).toBe(true);
    expect(isValidUrl("youtube.com/watch")).toBe(false);
    expect(isValidUrl("file:///etc/passwd")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
