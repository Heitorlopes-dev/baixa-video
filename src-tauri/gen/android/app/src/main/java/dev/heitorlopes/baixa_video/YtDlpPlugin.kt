package dev.heitorlopes.baixa_video

import android.app.Activity
import android.os.Environment
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.concurrent.thread

@InvokeArg
class StartArgs {
    lateinit var id: String
    lateinit var url: String
    var args: List<String> = emptyList()
}

@InvokeArg
class IdArgs {
    lateinit var id: String
}

/**
 * Prova de viabilidade (Fase 1): roda o yt-dlp da youtubedl-android.
 * As linhas da saída vão para uma fila com o horário (ms) de cada uma, e a tela
 * busca as novas com `poll`. Um download por vez.
 */
@TauriPlugin
class YtDlpPlugin(private val activity: Activity) : Plugin(activity) {
    private val lines = ConcurrentLinkedQueue<String>()

    @Volatile
    private var exitCode: Int? = null

    private fun log(line: String) {
        lines.add("${System.currentTimeMillis()}|$line")
    }

    @Command
    fun init(invoke: Invoke) {
        thread {
            try {
                val t0 = System.currentTimeMillis()
                YoutubeDL.getInstance().init(activity.application)
                FFmpeg.getInstance().init(activity.application)
                invoke.resolve(JSObject().put("ms", System.currentTimeMillis() - t0))
            } catch (e: Exception) {
                invoke.reject(e.toString())
            }
        }
    }

    @Command
    fun version(invoke: Invoke) {
        invoke.resolve(JSObject().put("version", YoutubeDL.getInstance().version(activity.application) ?: "?"))
    }

    @Command
    fun update(invoke: Invoke) {
        thread {
            try {
                val t0 = System.currentTimeMillis()
                val status = YoutubeDL.getInstance().updateYoutubeDL(activity.application, YoutubeDL.UpdateChannel.STABLE)
                invoke.resolve(
                    JSObject()
                        .put("status", status?.name ?: "null")
                        .put("version", YoutubeDL.getInstance().version(activity.application) ?: "?")
                        .put("ms", System.currentTimeMillis() - t0),
                )
            } catch (e: Exception) {
                invoke.reject(e.toString())
            }
        }
    }

    @Command
    fun start(invoke: Invoke) {
        val args = invoke.parseArgs(StartArgs::class.java)
        val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)!!.absolutePath
        lines.clear()
        exitCode = null
        thread {
            try {
                log("início")
                val request = YoutubeDLRequest(args.url).addCommands(listOf("-P", dir) + args.args)
                val response = YoutubeDL.getInstance().execute(request, args.id) { _, _, line -> log(line) }
                response.err.lines().filter { it.isNotBlank() }.forEach { log("stderr: $it") }
                exitCode = response.exitCode
            } catch (e: YoutubeDL.CanceledException) {
                log("cancelado")
                exitCode = -2
            } catch (e: Exception) {
                log("exceção: $e")
                exitCode = -1
            }
        }
        invoke.resolve(JSObject().put("dir", dir))
    }

    @Command
    fun poll(invoke: Invoke) {
        val out = JSArray()
        generateSequence { lines.poll() }.forEach { out.put(it) }
        val result = JSObject().put("lines", out)
        exitCode?.let { result.put("exitCode", it) }
        invoke.resolve(result)
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(IdArgs::class.java)
        invoke.resolve(JSObject().put("ok", YoutubeDL.getInstance().destroyProcessById(args.id)))
    }
}
