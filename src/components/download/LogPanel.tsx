import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "../ui/Button";

type Props = {
  log: readonly string[];
  open: boolean;
  onToggle: () => void;
  /** Ações à direita do "Mostrar detalhes", como o "Atualizar yt-dlp". */
  actions?: ReactNode;
};

export function LogPanel({ log, open, onToggle, actions }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  // Sincroniza o DOM: o painel acompanha a última linha.
  useEffect(() => {
    const pre = preRef.current;
    if (pre && log.length > 0) pre.scrollTop = pre.scrollHeight;
  }, [log]);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button variant="link" onClick={onToggle}>
          {open ? "Esconder detalhes" : "Mostrar detalhes"}
        </Button>
        {actions}
      </div>
      {open && (
        <pre
          ref={preRef}
          className="h-56 select-text overflow-auto rounded-md bg-black p-3 font-mono text-xs leading-5 text-green-300"
        >
          {log.length === 0 ? "Nada ainda." : log.join("\n")}
        </pre>
      )}
    </section>
  );
}
