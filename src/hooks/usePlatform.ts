import { useQuery } from "@tanstack/react-query";
import { commands } from "../bindings";
import { androidEngine } from "../lib/engines/android";
import { desktopEngine } from "../lib/engines/desktop";

/** Em que plataforma o app roda, dito pelo Rust. undefined só no primeiro instante. */
export function usePlatform() {
  return useQuery({
    queryKey: ["platform"],
    queryFn: () => commands.platform(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  }).data;
}

/** O motor de download desta plataforma. */
export function useEngine() {
  const platform = usePlatform();
  if (platform === undefined) return undefined;
  return platform === "android" ? androidEngine : desktopEngine;
}
