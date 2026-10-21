package dev.heitorlopes.baixa_video

import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Tela de entrada do Instagram: a página de login dele numa WebView. Fecha sozinha
 * (RESULT_OK) quando aparece o cookie da sessão; voltar sem entrar fecha sem login.
 * Quem grava o arquivo de cookies é o YtDlpPlugin, no retorno (loginFinished).
 */
class LoginActivity : ComponentActivity() {
    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val cookies = CookieManager.getInstance()
        web = WebView(this)
        cookies.setAcceptCookie(true)
        cookies.setAcceptThirdPartyCookies(web, true)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) = finishIfSignedIn()

            // O Instagram troca de página sem recarregar (SPA): isto avisa essas trocas também.
            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) = finishIfSignedIn()
        }

        // A WebView ignora o próprio padding: o recuo das barras do sistema e do teclado vai na moldura.
        val frame = FrameLayout(this).apply { addView(web) }
        ViewCompat.setOnApplyWindowInsetsListener(frame) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(frame)

        onBackPressedDispatcher.addCallback(this) {
            if (web.canGoBack()) web.goBack() else finish()
        }
        web.loadUrl(INSTAGRAM_LOGIN_URL)
    }

    private fun finishIfSignedIn() {
        val cookies = CookieManager.getInstance()
        if (isFinishing || !hasInstagramSession(cookies.getCookie(INSTAGRAM_URL))) return
        cookies.flush()
        setResult(RESULT_OK)
        finish()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
