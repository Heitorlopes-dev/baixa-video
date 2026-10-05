package dev.heitorlopes.baixa_video

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Mantém o app vivo enquanto um download roda com a tela apagada (serviço em primeiro
 * plano do tipo dataSync) e mostra o progresso na notificação. O download em si roda
 * no YtDlpPlugin; este serviço só segura o processo e a notificação.
 */
class DownloadService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel(this)
        val notification = progressNotification(this, null)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(PROGRESS_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(PROGRESS_ID, notification)
        }
        return START_NOT_STICKY
    }

    companion object {
        private const val CHANNEL_ID = "downloads"
        private const val PROGRESS_ID = 1
        private const val DONE_ID = 2

        @Volatile
        private var lastPercent = -1

        private fun ensureChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW),
                )
            }
        }

        private fun progressNotification(context: Context, percent: Int?): Notification =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("Baixando")
                .setContentText(percent?.let { "$it%" } ?: "Preparando…")
                .setProgress(100, percent ?: 0, percent == null)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()

        fun start(context: Context) {
            lastPercent = -1
            context.startForegroundService(Intent(context, DownloadService::class.java))
        }

        /** Atualiza a notificação no máximo uma vez por ponto percentual. */
        fun progress(context: Context, progress: Float) {
            val percent = progress.toInt().coerceIn(0, 100)
            if (percent == lastPercent) return
            lastPercent = percent
            context.getSystemService(NotificationManager::class.java).notify(PROGRESS_ID, progressNotification(context, percent))
        }

        /** Notificação de concluído: tocar abre o arquivo. */
        fun finished(context: Context, name: String, uri: Uri) {
            ensureChannel(context)
            val view = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, context.contentResolver.getType(uri))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            val tap = PendingIntent.getActivity(context, 0, view, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Download concluído")
                .setContentText(name)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build()
            context.getSystemService(NotificationManager::class.java).notify(DONE_ID, notification)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, DownloadService::class.java))
        }
    }
}
