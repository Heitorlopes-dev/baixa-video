import { type DownloadState, isDownloading, readyFile } from "../../lib/download";
import { Button } from "../ui/Button";
import { statusLabel } from "./statusView";

type Props = {
  state: DownloadState;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  onOpenFolder: (filePath: string) => void;
};

export function DownloadActions({ state, canStart, onStart, onCancel, onOpenFolder }: Props) {
  const file = readyFile(state);

  return (
    <div className="flex items-center gap-2">
      {isDownloading(state) ? (
        <Button variant="danger" disabled={state.cancelling} onClick={onCancel}>
          Cancelar
        </Button>
      ) : (
        <Button variant="primary" disabled={!canStart} onClick={onStart}>
          Baixar
        </Button>
      )}
      {file !== null && (
        <Button variant="secondary" onClick={() => onOpenFolder(file)}>
          Abrir pasta
        </Button>
      )}
      <span className="ml-auto text-sm opacity-70">{statusLabel(state)}</span>
    </div>
  );
}
