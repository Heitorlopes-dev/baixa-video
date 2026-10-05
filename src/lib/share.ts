// Texto compartilhado por outro app ("Compartilhar → Baixa Vídeo"). Às vezes vem
// só o link, às vezes com frase junto ("Olha este vídeo: https://…").

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;
/** Pontuação que costuma colar no fim do link quando ele está no meio de uma frase. */
const TRAILING = /[).,!?;:]+$/;

export function extractUrl(text: string): string | null {
  const match = URL_IN_TEXT.exec(text);
  return match ? match[0].replace(TRAILING, "") : null;
}
