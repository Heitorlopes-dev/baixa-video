import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Engine } from "../lib/engine";

/**
 * Destino gerenciado pelo motor (Android): a pasta atual e a troca pelo seletor nativo.
 * Com destino por caminho (desktop) devolve null e a tela usa o seletor do Tauri.
 */
export function useManagedDestination(engine: Engine | undefined) {
  const managed = engine?.destination.kind === "managed" ? engine.destination : null;
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["destination"],
    enabled: managed !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: () => (managed ? managed.current() : Promise.reject(new Error("destino não gerenciado"))),
  });
  const pick = useMutation({
    mutationFn: () => (managed ? managed.pick() : Promise.reject(new Error("destino não gerenciado"))),
    onSuccess: (destination) => queryClient.setQueryData(["destination"], destination),
  });
  if (!managed) return null;
  return { label: current.data?.label ?? "…", pick: () => pick.mutate(), picking: pick.isPending };
}
