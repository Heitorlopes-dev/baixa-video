package dev.heitorlopes.baixa_video

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
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

@InvokeArg
class OpenArgs {
    lateinit var uri: String
}

@InvokeArg
class CheckUpdateArgs {
    lateinit var url: String
}

@InvokeArg
class WatchSharedArgs {
    lateinit var onShared: Channel
}

class LineEvent(val text: String, val stream: String) {
    val kind = "line"
}

class ExitEvent(val code: Int?) {
    val kind = "exit"
}

class SavedEvent(val uri: String, val name: String) {
    val kind = "saved"
}

class SharedTextEvent(val text: String)

class LatestReleaseReply(val version: String, val apkUrl: String?)

class DestinationReply(val label: String, val custom: Boolean)

private const val FOLDER_KEY = "pasta"

class VersionReply(val version: String)

class UpdateReply(val status: String, val version: String)

class CancelReply(val cancelled: Boolean)

/** Roda o yt-dlp da youtubedl-android. A inicialização (Python e ffmpeg) acontece uma vez, em segundo plano. */
@TauriPlugin
class YtDlpPlugin(private val activity: Activity) : Plugin(activity) {
    private val ready = CountDownLatch(1)

    @Volatile
    private var initError: Exception? = null

    // "Compartilhar → Baixa Vídeo": o texto chega pela intent. Se a tela ainda não se
    // inscreveu (app aberto pelo próprio compartilhamento), fica guardado até ela pedir.
    @Volatile
    private var sharedChannel: Channel? = null

    @Volatile
    private var pendingShared: String? = null

    private fun sharedText(intent: Intent?): String? =
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") intent.getStringExtra(Intent.EXTRA_TEXT) else null

    override fun onNewIntent(intent: Intent) {
        val text = sharedText(intent) ?: return
        val channel = sharedChannel
        if (channel != null) channel.sendObject(SharedTextEvent(text)) else pendingShared = text
    }

    override fun load(webView: WebView) {
        pendingShared = sharedText(activity.intent)
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

    /** Onde o yt-dlp baixa: pasta interna do app. No fim o arquivo é copiado para Downloads/BaixaVideo. */
    private fun workDir(): String =
        (activity.getExternalFilesDir("baixando") ?: File(activity.filesDir, "baixando")).also { it.mkdirs() }.absolutePath

    /**
     * QuickJS-NG empacotado no APK (scripts/fetch-sidecars.sh aarch64-linux-android), cerca de
     * 2x mais rápido no desafio do YouTube que o QuickJS da biblioteca. Vai depois do
     * --js-runtimes que a biblioteca põe, então é ele que vale. Sem o arquivo (outra
     * arquitetura), fica o da biblioteca.
     */
    private fun quickJsNgArgs(): List<String> {
        val binary = File(activity.applicationInfo.nativeLibraryDir, "libqjsng.so")
        return if (binary.exists()) listOf("--js-runtimes", "quickjs:${binary.absolutePath}") else emptyList()
    }

    /** Cache do yt-dlp: guarda a solução do desafio do YouTube entre um vídeo e outro. */
    private fun cacheDir(): String = File(activity.cacheDir, "yt-dlp").also { it.mkdirs() }.absolutePath

    private val prefs by lazy { activity.getSharedPreferences("baixa_video", Context.MODE_PRIVATE) }

    /**
     * Pasta escolhida no seletor do Android, se ainda houver permissão de escrita nela.
     * Se a pasta sumiu ou a permissão foi revogada, esquece a escolha e volta ao padrão.
     */
    private fun chosenFolder(): Uri? {
        val saved = prefs.getString(FOLDER_KEY, null)?.let(Uri::parse) ?: return null
        val allowed = activity.contentResolver.persistedUriPermissions.any { it.uri == saved && it.isWritePermission }
        if (!allowed) prefs.edit().remove(FOLDER_KEY).apply()
        return saved.takeIf { allowed }
    }

    private fun currentDestination(): DestinationReply =
        chosenFolder()?.let { DestinationReply(folderLabel(DocumentsContract.getTreeDocumentId(it)), true) }
            ?: DestinationReply(DEFAULT_DESTINATION, false)

    /**
     * Copia o arquivo pronto para o lugar que a pessoa vê e apaga a cópia interna:
     * a pasta escolhida no seletor, ou Downloads/BaixaVideo pelo MediaStore (Android 10+,
     * sem permissão). Nome repetido o próprio Android renomeia.
     */
    private fun publish(file: File): Uri {
        val resolver = activity.contentResolver
        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
        val folder = chosenFolder()
        val uri = if (folder != null) {
            val parent = DocumentsContract.buildDocumentUriUsingTree(folder, DocumentsContract.getTreeDocumentId(folder))
            DocumentsContract.createDocument(resolver, parent, mime, file.name)
                ?: throw IllegalStateException("o Android não criou o arquivo na pasta escolhida")
        } else {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, file.name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/BaixaVideo")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("o Android não criou o arquivo em Downloads")
        }
        resolver.openOutputStream(uri).use { out ->
            requireNotNull(out) { "sem acesso ao arquivo de destino" }
            file.inputStream().use { it.copyTo(out) }
        }
        if (folder == null) {
            resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        }
        file.delete()
        return uri
    }

    /** Android 13+: pede uma vez a permissão de notificação. O download segue mesmo se negar. */
    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

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
        askNotificationPermission()
        background(invoke) {
            invoke.resolve()
            val app = activity.application
            DownloadService.start(app)
            val finalPath = File(workDir(), "${request.id}.caminho")
            val code: Int? = try {
                val ytdlp = YoutubeDLRequest(request.url)
                    .addOption("--cache-dir", cacheDir())
                    .addCommands(
                        listOf("-P", workDir(), "--print-to-file", "after_move:%(filepath)s", finalPath.absolutePath) +
                            quickJsNgArgs() +
                            request.args,
                    )
                val exit = YoutubeDL.getInstance().execute(ytdlp, request.id) { progress, _, line ->
                    events.sendObject(LineEvent(line, STDOUT))
                    DownloadService.progress(app, progress)
                }.exitCode
                if (exit == 0) {
                    val file = File(finalPath.readLines().last { it.isNotBlank() })
                    val uri = publish(file)
                    events.sendObject(SavedEvent(uri.toString(), file.name))
                    DownloadService.finished(app, file.name, uri)
                }
                exit
            } catch (e: YoutubeDL.CanceledException) {
                null
            } catch (e: Exception) {
                // Saída diferente de 0 também chega aqui: a biblioteca lança com o stderr na mensagem.
                (e.message ?: e.toString()).lines().filter { it.isNotBlank() }.forEach {
                    events.sendObject(LineEvent(it, STDERR))
                }
                1
            } finally {
                finalPath.delete()
                DownloadService.stop(app)
            }
            events.sendObject(ExitEvent(code))
        }
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(CancelArgs::class.java)
        invoke.resolveObject(CancelReply(YoutubeDL.getInstance().destroyProcessById(args.id)))
    }

    /** Abre o arquivo baixado no app que a pessoa escolher, com leitura liberada só para ele. */
    @Command
    fun open(invoke: Invoke) {
        val args = invoke.parseArgs(OpenArgs::class.java)
        val uri = Uri.parse(args.uri)
        val view = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, activity.contentResolver.getType(uri))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            activity.startActivity(Intent.createChooser(view, "Abrir com"))
            invoke.resolve()
        } catch (e: ActivityNotFoundException) {
            invoke.reject("nenhum app instalado abre esse tipo de arquivo")
        }
    }

    @Command
    fun watchShared(invoke: Invoke) {
        val args = invoke.parseArgs(WatchSharedArgs::class.java)
        sharedChannel = args.onShared
        pendingShared?.let {
            pendingShared = null
            args.onShared.sendObject(SharedTextEvent(it))
        }
        invoke.resolve()
    }

    /** Lê o latest.json da Release (o mesmo do desktop) e devolve a versão e o link do APK. */
    @Command
    fun checkUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(CheckUpdateArgs::class.java)
        thread {
            try {
                val connection = URL(args.url).openConnection() as HttpURLConnection
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val apkUrl = json.optJSONObject("android")?.optString("url")?.takeIf { it.isNotBlank() }
                invoke.resolveObject(LatestReleaseReply(json.getString("version"), apkUrl))
            } catch (e: Exception) {
                invoke.reject("não deu para consultar a versão nova: ${e.message ?: e}")
            }
        }
    }

    /** Para onde os arquivos vão: a pasta escolhida ou o padrão. */
    @Command
    fun destination(invoke: Invoke) {
        invoke.resolveObject(currentDestination())
    }

    /** Abre o seletor de pastas do Android. Cancelar mantém o destino atual. */
    @Command
    fun pickFolder(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
        )
        startActivityForResult(invoke, intent, "folderPicked")
    }

    /** Guarda a permissão permanente sobre a pasta escolhida e solta a da anterior. */
    @ActivityCallback
    fun folderPicked(invoke: Invoke, result: ActivityResult) {
        val uri = result.data?.data
        if (result.resultCode == Activity.RESULT_OK && uri != null) {
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            val resolver = activity.contentResolver
            chosenFolder()?.takeIf { it != uri }?.let { old -> runCatching { resolver.releasePersistableUriPermission(old, flags) } }
            resolver.takePersistableUriPermission(uri, flags)
            prefs.edit().putString(FOLDER_KEY, uri.toString()).apply()
        }
        invoke.resolveObject(currentDestination())
    }
}
