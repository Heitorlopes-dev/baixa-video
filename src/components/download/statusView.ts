// Como cada status aparece na tela: rótulo, cor da barra e se a barra fica cheia.
// O `satisfies` obriga a cobrir todos os status: um status novo sem entrada aqui não compila.
import type { DownloadState, Status } from "../../lib/download";

type StatusView = {
  label: (state: DownloadState) => string;
  bar: string;
  /** Barra cheia independente do progresso (conversão não tem porcentagem). */
  fullBar: boolean;
};

function partLabel({ atual, total }: DownloadState["part"]): string {
  return total > 1 && atual > 0 ? ` (parte ${atual} de ${total})` : "";
}

export const STATUS_VIEW = {
  parado: { label: () => "", bar: "bg-blue-500", fullBar: false },
  baixando: {
    label: ({ part, progress }) => `Baixando${partLabel(part)}… ${progress.toFixed(0)}%`,
    bar: "bg-blue-500",
    fullBar: false,
  },
  convertendo: { label: () => "Convertendo…", bar: "animate-pulse bg-blue-500", fullBar: true },
  concluido: { label: () => "Concluído", bar: "bg-blue-500", fullBar: false },
  erro: { label: () => "Deu erro. Veja os detalhes.", bar: "bg-red-500", fullBar: false },
  cancelado: { label: () => "Cancelado", bar: "bg-blue-500", fullBar: false },
  atualizando: { label: () => "Atualizando o yt-dlp…", bar: "bg-blue-500", fullBar: false },
} satisfies Record<Status, StatusView>;

export function statusLabel(state: DownloadState): string {
  return STATUS_VIEW[state.status].label(state);
}

export function barWidth(state: DownloadState): number {
  return STATUS_VIEW[state.status].fullBar ? 100 : state.progress;
}
