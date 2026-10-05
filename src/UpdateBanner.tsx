import { useState } from "react";
import { useInstallUpdate, useUpdateCheck } from "./hooks/useUpdater";

type Props = {
  /** Download em andamento: instalar agora fecharia o app no meio dele. */
  disabled: boolean;
};

export function UpdateBanner({ disabled }: Props) {
  const { data: update } = useUpdateCheck();
  const [percent, setPercent] = useState<number | null>(null);
  const install = useInstallUpdate(setPercent);

  if (!update) return null;

  const label = install.isPending
    ? `Atualizando${percent === null ? "…" : `… ${percent.toFixed(0)}%`}`
    : `Versão ${update.version} disponível (você tem a ${update.currentVersion}).`;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex-1">{label}</span>
        {!install.isPending && (
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
            title={disabled ? "Espere o download terminar" : undefined}
            onClick={() => install.mutate(update)}
          >
            Atualizar agora
          </button>
        )}
      </div>
      {install.isError && (
        <span className="text-red-600 dark:text-red-400">
          Não deu para atualizar: {install.error instanceof Error ? install.error.message : String(install.error)}
        </span>
      )}
    </div>
  );
}
