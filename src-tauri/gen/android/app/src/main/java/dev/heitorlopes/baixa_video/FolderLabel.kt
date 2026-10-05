package dev.heitorlopes.baixa_video

/** Destino quando a pessoa não escolheu pasta: o MediaStore grava em Downloads/BaixaVideo. */
const val DEFAULT_DESTINATION = "Downloads/BaixaVideo"

/**
 * Nome legível de uma pasta escolhida no seletor do Android, a partir do id técnico
 * da árvore: "primary:Movies/Baixa" vira "Movies/Baixa"; "1A2B-3C4D:Videos" (cartão de
 * memória) vira "Cartão SD/Videos". Pura, para testar sem celular.
 */
fun folderLabel(treeDocumentId: String): String {
    val volume = treeDocumentId.substringBefore(':')
    val path = treeDocumentId.substringAfter(':', "").trim('/')
    val prefix = if (volume == "primary") "" else "Cartão SD"
    return when {
        prefix.isEmpty() && path.isEmpty() -> "Armazenamento interno"
        prefix.isEmpty() -> path
        path.isEmpty() -> prefix
        else -> "$prefix/$path"
    }
}
