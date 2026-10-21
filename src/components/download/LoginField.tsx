import { useId } from "react";
import { BROWSERS, BROWSER_IDS, type BrowserId } from "../../lib/ytdlp";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Select } from "../ui/Select";

const BROWSER_OPTIONS = BROWSER_IDS.map((id) => ({ value: id, label: BROWSERS[id] }));

type Props = {
  /** Login guardado pelo motor (Android). null: login pelo navegador (desktop). */
  managed: { signedIn: boolean | undefined; signIn: () => void; signOut: () => void; pending: boolean } | null;
  browser: BrowserId;
  onBrowserChange: (browser: BrowserId) => void;
  disabled: boolean;
  /** O último download falhou por falta de login: mostra o que fazer. */
  needed: boolean;
};

function Hint({ children, alert }: { children: string; alert?: boolean }) {
  return <p className={alert ? "text-sm text-red-600 dark:text-red-400" : "text-xs opacity-70"}>{children}</p>;
}

export function LoginField({ managed, browser, onBrowserChange, disabled, needed }: Props) {
  const browserId = useId();

  if (managed === null) {
    return (
      <Field label="Usar login do navegador" htmlFor={browserId}>
        <Select
          id={browserId}
          options={BROWSER_OPTIONS}
          value={browser}
          onValueChange={onBrowserChange}
          disabled={disabled}
        />
        <Hint>
          Para Instagram e outros sites que pedem conta: entre no site por esse navegador antes. No Windows, use o
          Firefox (o Chrome não deixa outro programa ler o login dele).
        </Hint>
        {needed && (
          <Hint alert>
            {browser === "nenhum"
              ? "Esse link pede login: escolha acima o navegador em que você entrou no site e baixe de novo."
              : "O site recusou mesmo com o login do navegador. Confira se você está logado nele e baixe de novo."}
          </Hint>
        )}
      </Field>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">Conta do Instagram</span>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm opacity-80">
          {managed.signedIn === undefined ? "…" : managed.signedIn ? "Conectada" : "Não conectada"}
        </p>
        {managed.signedIn ? (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={disabled || managed.pending}
            onClick={managed.signOut}
          >
            Sair
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={disabled || managed.pending || managed.signedIn === undefined}
            onClick={managed.signIn}
          >
            Entrar no Instagram
          </Button>
        )}
      </div>
      <Hint>Só para vídeos que pedem login. O login fica guardado apenas neste aparelho.</Hint>
      {needed && (
        <Hint alert>
          {managed.signedIn
            ? "O Instagram recusou mesmo com login. Se faz tempo que você entrou, toque em Sair, entre de novo e baixe outra vez."
            : "Esse link pede login: toque em Entrar no Instagram e baixe de novo."}
        </Hint>
      )}
    </div>
  );
}
