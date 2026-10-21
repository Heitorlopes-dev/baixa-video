package dev.heitorlopes.baixa_video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InstagramLoginTest {
    @Test
    fun separaOsCookiesDoCabecalho() {
        assertEquals(
            listOf("csrftoken" to "abc", "sessionid" to "123%3Axyz", "vazio" to ""),
            parseCookieHeader("csrftoken=abc; sessionid=123%3Axyz;vazio=; semvalor; =sóvalor"),
        )
        assertEquals(emptyList<Pair<String, String>>(), parseCookieHeader(null))
    }

    @Test
    fun soContaComoLoginComOCookieDaSessao() {
        assertTrue(hasInstagramSession("csrftoken=abc; sessionid=123%3Axyz"))
        assertFalse(hasInstagramSession("csrftoken=abc; mid=xyz"))
        assertFalse(hasInstagramSession("sessionid=; csrftoken=abc"))
        assertFalse(hasInstagramSession(null))
    }

    @Test
    fun arquivoNoFormatoQueOYtDlpLe() {
        assertEquals(
            "# Netscape HTTP Cookie File\n" +
                ".instagram.com\tTRUE\t/\tTRUE\t1800000000\tcsrftoken\tabc\n" +
                ".instagram.com\tTRUE\t/\tTRUE\t1800000000\tsessionid\t123%3Axyz\n",
            netscapeCookies("csrftoken=abc; sessionid=123%3Axyz", 1_800_000_000),
        )
    }
}
