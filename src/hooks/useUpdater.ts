import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { commands } from "../bindings";
import { engineErrorMessage } from "../lib/engines/android";
import { isNewer } from "../lib/version";
import { isStaleYtDlp } from "../lib/ytdlp";
import { usePlatform } from "./usePlatform";

/**
 * Confere uma vez, ao abrir o app, se há versão nova na última Release.
 * Sem internet ou sem latest.json a consulta falha em silêncio: não é erro do usuário.
 */
export function useUpdateCheck() {
  // A atualização automática do app só existe no desktop (no Android não há o plugin).
  const platform = usePlatform();
  return useQuery({
    queryKey: ["app-update"],
    queryFn: () => check(),
    enabled: platform === "desktop",
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

/**
 * Se o botão "Atualizar yt-dlp" pode funcionar. No AppImage não pode: o yt-dlp
 * fica num sistema de arquivos só de leitura e chega novo junto com o app.
 */
export function useCanUpdateYtDlp() {
  return useQuery({
    queryKey: ["can-update-ytdlp"],
    queryFn: async () => !(await commands.isAppimage()),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Android: versão nova publicada? Lê o latest.json pela ponte (o Kotlin busca; a tela
 * não chama serviço externo) e devolve o link do APK só se a versão for maior.
 */
export function useAndroidUpdate() {
  const platform = usePlatform();
  return useQuery({
    queryKey: ["android-update"],
    enabled: platform === "android",
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [result, currentVersion] = await Promise.all([commands.engineLatestRelease(), getVersion()]);
      if (result.status === "error") throw new Error(engineErrorMessage(result.error));
      const { version, apkUrl } = result.data;
      return apkUrl && isNewer(version, currentVersion) ? { version, currentVersion, url: apkUrl } : null;
    },
  });
}

/**
 * Android: o yt-dlp que vem no APK é o da youtubedl-android, com meses de atraso, e o
 * YouTube recusa o download no meio (403) até ele ser atualizado. Ao abrir, se a versão
 * instalada estiver velha, dispara uma vez a mesma atualização do botão, assim que a tela
 * estiver livre. Na primeira abertura sempre atualiza; depois, só a cada 90 dias parado.
 */
export function useAutoUpdateYtDlp(busy: boolean, updateYtDlp: () => Promise<void>) {
  const platform = usePlatform();
  const { data: stale } = useQuery({
    queryKey: ["ytdlp-stale"],
    enabled: platform === "android",
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await commands.engineVersion();
      if (result.status === "error") throw new Error(engineErrorMessage(result.error));
      return isStaleYtDlp(result.data, new Date());
    },
  });
  const fired = useRef(false);

  useEffect(() => {
    if (!stale || busy || fired.current) return;
    fired.current = true;
    void updateYtDlp();
  }, [stale, busy, updateYtDlp]);
}
