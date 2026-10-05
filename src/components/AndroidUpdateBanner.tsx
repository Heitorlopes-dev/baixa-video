import { openUrl } from "@tauri-apps/plugin-opener";
import { useAndroidUpdate } from "../hooks/useUpdater";
import { Button } from "./ui/Button";

/**
 * No Android não existe o atualizador do Tauri: a faixa aponta para o APK novo da
 * Release, que o navegador baixa e o próprio Android pede para instalar.
 */
export function AndroidUpdateBanner() {
  const { data: update } = useAndroidUpdate();
  if (!update) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm">
      <span className="flex-1">
        Versão {update.version} disponível (você tem a {update.currentVersion}).
      </span>
      <Button variant="primary" size="sm" onClick={() => void openUrl(update.url)}>
        Baixar
      </Button>
    </div>
  );
}
