package dev.heitorlopes.baixa_video

/** Endereço que o CookieManager consulta para saber os cookies do Instagram. */
const val INSTAGRAM_URL = "https://www.instagram.com/"

/** Onde a tela de entrada (LoginActivity) começa. */
const val INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/"

/** Validade gravada no arquivo: o CookieManager não informa a real. Login vencido antes disso o Instagram recusa, e é só entrar de novo. */
const val COOKIE_LIFETIME_SECONDS = 365L * 24 * 60 * 60

/** "a=1; b=2" (o que o CookieManager devolve) em pares nome/valor. Pedaço sem "=" é ignorado. */
fun parseCookieHeader(header: String?): List<Pair<String, String>> =
    header.orEmpty()
        .split(';')
        .map { it.trim() }
        .filter { '=' in it && !it.startsWith('=') }
        .map { it.substringBefore('=') to it.substringAfter('=') }

/** Entrou de fato: o Instagram só entrega o cookie da sessão depois do login (e da verificação em duas etapas, se houver). */
fun hasInstagramSession(header: String?): Boolean =
    parseCookieHeader(header).any { (name, value) -> name == "sessionid" && value.isNotBlank() }

/**
 * Arquivo de cookies no formato Netscape, o que o yt-dlp lê em --cookies. A primeira linha
 * é obrigatória: sem ela o yt-dlp recusa o arquivo. Cada cookie vale para .instagram.com
 * inteiro, só por HTTPS, até `expiresAt` (segundos desde 1970). Pura, para testar sem celular.
 */
fun netscapeCookies(header: String?, expiresAt: Long): String =
    buildString {
        append("# Netscape HTTP Cookie File\n")
        parseCookieHeader(header).forEach { (name, value) ->
            append(listOf(".instagram.com", "TRUE", "/", "TRUE", expiresAt.toString(), name, value).joinToString("\t"))
            append('\n')
        }
    }
