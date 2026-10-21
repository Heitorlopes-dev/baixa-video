import { describe, expect, test } from "bun:test";
import capability from "../../src-tauri/capabilities/default.json";
import { capabilityJson } from "../../scripts/gen-capability";
import {
  ARGS_LEN,
  FORMAT_IDS,
  buildArgs,
  coreArgs,
  isStaleYtDlp,
  isValidUrl,
  needsLogin,
  parseFilePath,
  parseFormatCount,
  parseLine,
  parsePhase,
  parseProgress,
  updateArgs,
} from "./ytdlp";

describe("buildArgs", () => {
  test("vídeo: baixa para a pasta, em mp4, com o caminho final impresso", () => {
    const args = buildArgs({
      url: " https://youtu.be/abc ",
      dir: "C:\\Users\\x\\Videos",
      format: "720p",
      binDir: "C:\\app",
      browser: "nenhum",
    });
    expect(args).toContain("--no-playlist");
    expect(args[args.indexOf("--ffmpeg-location") + 1]).toBe("C:\\app");
    expect(args[args.indexOf("--js-runtimes") + 1]).toBe("deno:C:\\app");
    expect(args.slice(args.indexOf("-P"), args.indexOf("-P") + 2)).toEqual(["-P", "C:\\Users\\x\\Videos"]);
    expect(args).toContain("--merge-output-format");
    expect(args).toContain("res:720,vcodec:h264,acodec:aac");
    expect(args[args.indexOf("--") + 1]).toBe("https://youtu.be/abc");
    expect(args[args.indexOf("--print") + 1]).toBe("after_move:ARQUIVO::%(filepath)s");
  });

  test("mp3: extrai áudio e não pede merge", () => {
    const args = buildArgs({ url: "https://x.y/z", dir: "/tmp", format: "mp3", binDir: "/app", browser: "nenhum" });
    expect(args).toContain("-x");
    expect(args).toContain("mp3");
    expect(args).not.toContain("--merge-output-format");
  });

  test("login do navegador: --cookies-from-browser com o navegador escolhido; sem login, nada", () => {
    const base = { url: "https://www.instagram.com/reel/abc/", dir: "/tmp", format: "melhor", binDir: "/app" } as const;
    const withLogin = buildArgs({ ...base, browser: "firefox" });
    expect(withLogin[withLogin.indexOf("--cookies-from-browser") + 1]).toBe("firefox");
    expect(buildArgs({ ...base, browser: "nenhum" })).not.toContain("--cookies-from-browser");
  });

  test("a URL vem logo depois de `--`, nunca é cortada pelo preenchimento", () => {
    for (const format of FORMAT_IDS) {
      const args = buildArgs({ url: "https://x.y/z", dir: "/tmp", format, binDir: "/app", browser: "nenhum" });
      expect(args[args.indexOf("--") + 1]).toBe("https://x.y/z");
    }
  });
});

describe("permissão posicional do sidecar (capabilities/default.json)", () => {
  const spawn = capability.permissions.find(
    (p): p is Extract<typeof p, { identifier: string }> =>
      typeof p === "object" && p.identifier === "shell:allow-spawn",
  );
  const validators = spawn?.allow[0]?.args ?? [];

  test("a lista de validadores tem exatamente ARGS_LEN posições", () => {
    expect(validators).toHaveLength(ARGS_LEN);
  });

  test("o JSON commitado é igual ao gerado pelo código (rode `bun run gen:capability`)", () => {
    expect(capability).toEqual(JSON.parse(capabilityJson()));
  });

  // Todo formato com e sem login: o login soma 2 argumentos, e a chamada mais longa tem de caber.
  const calls = [
    ...FORMAT_IDS.flatMap((format) =>
      (["nenhum", "firefox"] as const).map((browser) => ({
        name: `download ${format} (login: ${browser})`,
        args: buildArgs({
          url: "https://www.youtube.com/watch?v=1",
          dir: "C:\\Vídeos",
          format,
          binDir: "C:\\app",
          browser,
        }),
      })),
    ),
    { name: "update", args: updateArgs() },
  ];

  for (const { name, args } of calls) {
    test(`${name}: tem ARGS_LEN argumentos e cada um passa no validador da sua posição`, () => {
      expect(args).toHaveLength(ARGS_LEN);
      args.forEach((arg, i) => {
        const v = validators[i];
        if (typeof v === "string") expect(arg).toBe(v);
        else expect(new RegExp(v.validator).test(arg)).toBe(true);
      });
    });
  }

  test("os validadores recusam flags perigosas", () => {
    for (const v of validators) {
      if (typeof v === "string") continue;
      const re = new RegExp(v.validator);
      expect(re.test("--exec")).toBe(false);
      expect(re.test("--exec-before-download")).toBe(false);
      expect(re.test("--config-location")).toBe(false);
      expect(re.test("-a")).toBe(false);
    }
  });
});

describe("parseProgress", () => {
  test("lê o percentual da linha de download", () => {
    expect(parseProgress("[download]  45.3% of  120.00MiB at    5.00MiB/s ETA 00:15")).toBe(45.3);
    expect(parseProgress("[download] 100% of 120.00MiB in 00:30")).toBe(100);
  });

  test("ignora outras linhas", () => {
    expect(parseProgress("[youtube] abc: Downloading webpage")).toBeNull();
    expect(parseProgress('[Merger] Merging formats into "a.mp4"')).toBeNull();
  });
});

describe("parseFilePath", () => {
  test("reconhece a linha do --print", () => {
    expect(parseFilePath("ARQUIVO::C:\\Videos\\Título do vídeo.mp4\r")).toBe("C:\\Videos\\Título do vídeo.mp4");
    expect(parseFilePath("[download] Destination: a.mp4")).toBeNull();
  });
});

describe("parseFormatCount e parsePhase", () => {
  test("conta as partes pela lista de formatos", () => {
    expect(parseFormatCount("[info] jNQXAC9IVRw: Downloading 1 format(s): 133+140")).toBe(2);
    expect(parseFormatCount("[info] abc: Downloading 1 format(s): 251")).toBe(1);
    expect(parseFormatCount("[download] Destination: a.mp4")).toBeNull();
  });

  test("detecta início de parte e fase de conversão", () => {
    expect(parsePhase("[download] Destination: /x/a.f133.mp4")).toBe("stream");
    expect(parsePhase('[Merger] Merging formats into "/x/a.mp4"')).toBe("convert");
    expect(parsePhase("[ExtractAudio] Destination: /x/a.mp3")).toBe("convert");
    expect(parsePhase('[FixupM4a] Correcting container of "a.m4a"')).toBe("convert");
    expect(parsePhase("[download]  45.3% of 1MiB")).toBeNull();
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

describe("parseLine", () => {
  test("cada linha vira no máximo um evento com tipo", () => {
    expect(parseLine("[info] jNQXAC9IVRw: Downloading 1 format(s): 133+140")).toEqual({ kind: "formats", count: 2 });
    expect(parseLine("[download] Destination: /x/a.f133.mp4")).toEqual({ kind: "part-start" });
    expect(parseLine("[download]  45.3% of 1MiB at 1MiB/s ETA 00:00")).toEqual({ kind: "progress", percent: 45.3 });
    expect(parseLine('[Merger] Merging formats into "/x/a.mp4"')).toEqual({ kind: "convert" });
    expect(parseLine("[ExtractAudio] Destination: /x/a.mp3")).toEqual({ kind: "convert" });
    expect(parseLine("ARQUIVO::/x/a.mp4")).toEqual({ kind: "file", path: "/x/a.mp4" });
    expect(parseLine("[youtube] abc: Downloading webpage")).toBeNull();
  });

  test("o caminho final vence mesmo se parecer outra coisa", () => {
    expect(parseLine("ARQUIVO::/x/[download] 50% off.mp4")).toEqual({
      kind: "file",
      path: "/x/[download] 50% off.mp4",
    });
  });
});

describe("needsLogin", () => {
  test("reconhece os erros de falta de login do yt-dlp", () => {
    expect(
      needsLogin([
        "ERROR: [Instagram] DQx1: Requested content is not available, rate-limit reached or login required. Use --cookies, --cookies-from-browser, --username and --password, --netrc-cmd, or --netrc (instagram) to provide account credentials.",
      ]),
    ).toBe(true);
    expect(
      needsLogin([
        "ERROR: [Instagram] DQx1: Instagram sent an empty media response. Check if this post is accessible in your browser without being logged-in. If it is not, then use --cookies-from-browser or --cookies for the authentication.",
      ]),
    ).toBe(true);
  });

  test("a linha do comando com --cookies-from-browser e outros erros não contam", () => {
    expect(
      needsLogin([
        "> yt-dlp --cookies-from-browser firefox -P /tmp -- https://www.instagram.com/reel/abc/",
        "ERROR: [youtube] abc: Video unavailable",
      ]),
    ).toBe(false);
  });
});

describe("coreArgs", () => {
  test("o comum a qualquer plataforma: saída por linha, nome, caminho final e formato, sem caminhos do desktop", () => {
    const args = coreArgs("mp3");
    expect(args.slice(0, 3)).toEqual(["--newline", "--no-playlist", "--no-quiet"]);
    expect(args[args.indexOf("--print") + 1]).toBe("after_move:ARQUIVO::%(filepath)s");
    expect(args).toContain("-x");
    for (const desktopOnly of ["--ffmpeg-location", "--js-runtimes", "-P", "--windows-filenames", "--"]) {
      expect(args).not.toContain(desktopOnly);
    }
  });

  test("o desktop é o comum mais os extras, sem perder nada", () => {
    for (const format of FORMAT_IDS) {
      const desktop = buildArgs({ url: "https://x.y/z", dir: "/tmp", format, binDir: "/app", browser: "nenhum" });
      for (const arg of coreArgs(format)) expect(desktop).toContain(arg);
    }
  });
});

describe("isStaleYtDlp", () => {
  const today = new Date("2026-10-06T12:00:00Z");

  test("o yt-dlp que vem no APK (2025.11.12) está velho", () => {
    expect(isStaleYtDlp("2025.11.12", today)).toBe(true);
  });

  test("até 90 dias não precisa atualizar", () => {
    expect(isStaleYtDlp("2026.08.19", today)).toBe(false);
    expect(isStaleYtDlp("2026.07.08", today)).toBe(false);
    expect(isStaleYtDlp("2026.07.07", today)).toBe(true);
  });

  test("versão nightly, com sufixo depois da data, conta pela data", () => {
    expect(isStaleYtDlp("2026.09.30.232425", today)).toBe(false);
  });

  test("versão que não dá para ler conta como velha", () => {
    expect(isStaleYtDlp("desconhecida", today)).toBe(true);
    expect(isStaleYtDlp("", today)).toBe(true);
  });
});
