import type { DownloadState } from "../../lib/download";
import { cx } from "../ui/cx";
import { STATUS_VIEW, barWidth } from "./statusView";

export function ProgressBar({ state }: { state: DownloadState }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-neutral-500/20">
      <div
        className={cx("h-full transition-[width]", STATUS_VIEW[state.status].bar)}
        style={{ width: `${barWidth(state)}%` }}
      />
    </div>
  );
}
