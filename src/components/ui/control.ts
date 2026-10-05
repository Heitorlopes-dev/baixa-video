/** Fundo e texto explícitos nos dois temas: sem isso o seletor ficava ilegível no modo escuro. */
export const CONTROL_COLORS = "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100";

/** Em tela de toque, altura mínima de 44 px (recomendação de acessibilidade); com mouse, nada muda. */
export const CONTROL = `rounded-md border border-neutral-400/50 px-3 py-2 pointer-coarse:min-h-11 ${CONTROL_COLORS}`;
