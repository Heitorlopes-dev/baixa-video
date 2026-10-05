package dev.heitorlopes.baixa_video

import org.junit.Assert.assertEquals
import org.junit.Test

class FolderLabelTest {
    @Test
    fun armazenamentoInterno() {
        assertEquals("Movies/Baixa", folderLabel("primary:Movies/Baixa"))
        assertEquals("Download/Videos", folderLabel("primary:Download/Videos/"))
        assertEquals("Armazenamento interno", folderLabel("primary:"))
    }

    @Test
    fun cartaoDeMemoria() {
        assertEquals("Cartão SD/Videos", folderLabel("1A2B-3C4D:Videos"))
        assertEquals("Cartão SD", folderLabel("1A2B-3C4D:"))
    }
}
