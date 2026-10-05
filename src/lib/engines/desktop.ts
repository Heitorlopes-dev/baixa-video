// Motor do desktop: o yt-dlp embutido roda como sidecar, iniciado pela tela.
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Engine, Job, JobHandlers } from "../engine";
import { binDir, killProcessTree, spawnYtDlp } from "../sidecar";
import { buildArgs, updateArgs } from "../ytdlp";

async function run(args: string[], handlers: JobHandlers): Promise<Job> {
  const { child, exit } = await spawnYtDlp(args, { stdout: handlers.stdout, stderr: handlers.log });
  return { exit, cancel: () => killProcessTree(child) };
}

export const desktopEngine: Engine = {
  download: async (input, handlers) => {
    const args = buildArgs({ ...input, binDir: await binDir() });
    handlers.log(`> yt-dlp ${args.join(" ")}`);
    return run(args, handlers);
  },
  updateYtDlp: (handlers) => run(updateArgs(), handlers),
  open: (path) => revealItemInDir(path),
  openLabel: "Abrir pasta",
  fixedDestination: null,
};
