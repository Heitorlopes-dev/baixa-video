# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Baixa Vídeo ---
# As mensagens do contrato (YtDlpPlugin.kt) viram JSON pelos getters, via Jackson. Sem
# isto o otimizador da release encurta os nomes e o JSON sai com chaves erradas, quebrando
# o contrato com o Rust (contracts/android/) só na versão publicada.
-keep class dev.heitorlopes.baixa_video.** { *; }
# youtubedl-android: carrega Python, ffmpeg e QuickJS e usa Jackson internamente.
-keep class com.yausername.** { *; }
-dontwarn com.yausername.**
# A youtubedl-android descompacta o Python e o ffmpeg com a Commons Compress, que registra
# as classes de campo extra do ZIP por reflexão. Sem isto a release fecha ao abrir
# ("class ... is not a concrete class" no ExtraFieldUtils); o build de debug não otimiza
# e esconde o problema.
-keep class org.apache.commons.compress.archivers.zip.** { *; }
