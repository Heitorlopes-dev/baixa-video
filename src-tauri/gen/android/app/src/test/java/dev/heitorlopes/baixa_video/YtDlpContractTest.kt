package dev.heitorlopes.baixa_video

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Confere as classes do plugin contra os exemplos de contracts/android/, os mesmos
 * que o cargo test lê no Rust. Roda no computador, sem celular.
 */
class YtDlpContractTest {
    // ObjectMapper simples, como o do Tauri no Android (sem módulo Kotlin).
    private val mapper = ObjectMapper()

    // Os testes rodam a partir de src-tauri/gen/android/app.
    private fun file(name: String) = File("../../../../contracts/android/$name")

    private fun assertMatches(name: String, value: Any) =
        assertEquals(name, mapper.readTree(file(name)), mapper.valueToTree<JsonNode>(value))

    @Test
    fun eventos() {
        assertMatches("event-line-stdout.json", LineEvent("[download]  45.3% of  422.93KiB at 1.00MiB/s ETA 00:00", STDOUT))
        assertMatches("event-line-stderr.json", LineEvent("ERROR: [youtube] abc: Video unavailable", STDERR))
        assertMatches("event-exit.json", ExitEvent(0))
        assertMatches("event-exit-canceled.json", ExitEvent(null))
    }

    @Test
    fun respostas() {
        assertMatches("update-done.json", UpdateReply(UPDATE_DONE, "2026.09.30"))
        assertMatches("update-up-to-date.json", UpdateReply(UPDATE_UP_TO_DATE, "2026.08.19"))
        assertMatches("version.json", VersionReply("2026.08.19"))
        assertMatches("cancel.json", CancelReply(true))
    }

    @Test
    fun pedido() {
        val request = mapper.readValue(file("request.json"), DownloadRequestArgs::class.java)
        assertEquals("download-1", request.id)
        assertEquals("https://www.youtube.com/watch?v=jNQXAC9IVRw", request.url)
        assertEquals(listOf("--newline", "-f", "ba/b", "-x", "--audio-format", "mp3"), request.args)
    }
}
