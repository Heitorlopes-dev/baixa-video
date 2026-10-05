import { useMutation, useQuery } from "@tanstack/react-query";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

/**
 * Confere uma vez, ao abrir o app, se há versão nova na última Release.
 * Sem internet ou sem latest.json a consulta falha em silêncio: não é erro do usuário.
 */
export function useUpdateCheck() {
  return useQuery({
    queryKey: ["app-update"],
    queryFn: () => check(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

/** Baixa e instala a atualização. No Windows o instalador fecha o app e abre a versão nova. */
export function useInstallUpdate(onProgress: (percent: number | null) => void) {
  return useMutation({
    mutationFn: async (update: Update) => {
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          onProgress(total > 0 ? 0 : null);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) onProgress(Math.min(100, (downloaded / total) * 100));
        }
      });
      await relaunch();
    },
  });
}
