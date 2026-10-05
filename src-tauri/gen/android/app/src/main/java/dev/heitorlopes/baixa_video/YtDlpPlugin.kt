package dev.heitorlopes.baixa_video

import android.app.Activity
import android.os.Environment
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.util.concurrent.CountDownLatch
import kotlin.concurrent.thread

// Contrato com src-tauri/src/engine.rs. Cada classe abaixo tem um exemplo JSON em
// contracts/android/, conferido pelo teste YtDlpContractTest e pelo cargo test.

const val STDOUT = "stdout"
const val STDERR = "stderr"
const val UPDATE_DONE = "done"
const val UPDATE_UP_TO_DATE = "alreadyUpToDate"

@InvokeArg
class DownloadRequestArgs {
    lateinit var id: String
    lateinit var url: String
    var args: List<String> = emptyList()
}

@InvokeArg
class StartArgs {
    lateinit var request: DownloadRequestArgs
    lateinit var onEvent: Channel
}

@InvokeArg
class CancelArgs {
    lateinit var id: String
}

class LineEvent(val text: String, val stream: String) {
    val kind = "line"
}

class ExitEvent(val code: Int?) {
    val kind = "exit"
}

class VersionReply(val version: String)

class UpdateReply(val status: String, val version: String)

class CancelReply(val cancelled: Boolean)

/** Roda o yt-dlp da youtubedl-android. A inicialização (Python e ffmpeg) acontece uma vez, em segundo plano. */
@TauriPlugin
class YtDlpPlugin(private val activity: Activity) : Plugin(activity) {
    private val ready = CountDownLatch(1)

    @Volatile
    private var initError: Exception? = null

    override fun load(webView: WebView) {
        thread {
            try {
                YoutubeDL.getInstance().init(activity.application)
                FFmpeg.getInstance().init(activity.application)
            } catch (e: Exception) {
                initError = e
            } finally {
                ready.countDown()
            }
        }
    }

    /** Fora da thread principal e depois da inicialização; qualquer exceção vira reject. */
    private fun background(invoke: Invoke, block: () -> Unit) {
        thread {
            try {
                ready.await()
                initError?.let { throw it }
                block()
            } catch (e: Exception) {
                invoke.reject(e.message ?: e.toString())
            }
        }
    }

    private fun currentVersion(): String = YoutubeDL.getInstance().version(activity.application) ?: "desconhecida"

    /** Pasta interna do app por enquanto; a pasta Downloads pública entra na Fase 3. */
    private fun downloadDir(): String =
        (activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: activity.filesDir).absolutePath

    @Command
    fun version(invoke: Invoke) = background(invoke) {
        invoke.resolveObject(VersionReply(currentVersion()))
    }

    @Command
    fun update(invoke: Invoke) = background(invoke) {
        val status = YoutubeDL.getInstance().updateYoutubeDL(activity.application, YoutubeDL.UpdateChannel.STABLE)
        val name = if (status == YoutubeDL.UpdateStatus.DONE) UPDATE_DONE else UPDATE_UP_TO_DATE
        invoke.resolveObject(UpdateReply(name, currentVersion()))
    }

    @Command
    fun start(invoke: Invoke) {
        val args = invoke.parseArgs(StartArgs::class.java)
        val request = args.request
        val events = args.onEvent
        background(invoke) {
            invoke.resolve()
            val code: Int? = try {
                val ytdlp = YoutubeDLRequest(request.url).addCommands(listOf("-P", downloadDir()) + request.args)
                YoutubeDL.getInstance().execute(ytdlp, request.id) { _, _, line ->
                    events.sendObject(LineEvent(line, STDOUT))
                }.exitCode
            } catch (e: YoutubeDL.CanceledException) {
                null
            } catch (e: Exception) {
                // Saída diferente de 0 também chega aqui: a biblioteca lança com o stderr na mensagem.
                (e.message ?: e.toString()).lines().filter { it.isNotBlank() }.forEach {
                    events.sendObject(LineEvent(it, STDERR))
                }
                1
            }
            events.sendObject(ExitEvent(code))
        }
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(CancelArgs::class.java)
        invoke.resolveObject(CancelReply(YoutubeDL.getInstance().destroyProcessById(args.id)))
    }
}
