import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Engine } from "../lib/engine";

/**
 * Login guardado pelo motor (Android): se há login do Instagram, entrar e sair.
 * Com login pelo navegador (desktop) devolve null e a tela mostra a escolha do navegador.
 */
export function useManagedLogin(engine: Engine | undefined) {
  const managed = engine?.login.kind === "managed" ? engine.login : null;
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["login"],
    enabled: managed !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: () => (managed ? managed.current() : Promise.reject(new Error("login não gerenciado"))),
  });
  const change = useMutation({
    mutationFn: (action: "signIn" | "signOut") =>
      managed ? managed[action]() : Promise.reject(new Error("login não gerenciado")),
    onSuccess: (login) => queryClient.setQueryData(["login"], login),
  });
  if (!managed) return null;
  return {
    /** undefined enquanto a primeira consulta não volta. */
    signedIn: current.data?.signedIn,
    signIn: () => change.mutate("signIn"),
    signOut: () => change.mutate("signOut"),
    pending: change.isPending,
  };
}
