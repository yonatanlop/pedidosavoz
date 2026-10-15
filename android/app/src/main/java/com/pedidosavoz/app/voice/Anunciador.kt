package com.pedidosavoz.app.voice

import android.content.Context
import android.media.MediaPlayer
import com.pedidosavoz.app.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private val JSON_MEDIA_TYPE = "application/json".toMediaType()
private const val VOZ_RESPALDO = "EXAVITQu4vr4xnSDxMaL" // Sarah: voz "premade", siempre en el plan gratis.

/**
 * Anuncia frases cortas por voz usando ElevenLabs (modelo eleven_flash_v2_5,
 * baja latencia; voz "premade" disponible en el plan gratis). Si no hay API
 * key configurada (ELEVENLABS_API_KEY en local.properties), no hace nada —
 * el aviso en pantalla sigue funcionando igual, la voz es un plus opcional.
 */
class Anunciador(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun decir(texto: String) {
        if (BuildConfig.ELEVENLABS_API_KEY.isBlank() || texto.isBlank()) return
        scope.launch {
            try {
                val file = pedirAudio(texto)
                reproducir(file)
                file.delete()
            } catch (e: Exception) {
                // Silencioso: el aviso en pantalla ya se mostro, la voz es un plus.
            }
        }
    }

    private fun pedirAudio(texto: String): File {
        val voiceId = BuildConfig.ELEVENLABS_VOICE_ID.ifBlank { VOZ_RESPALDO }
        val body = JSONObject()
            .put("text", texto)
            .put("model_id", "eleven_flash_v2_5")
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)

        val request = Request.Builder()
            .url("https://api.elevenlabs.io/v1/text-to-speech/$voiceId?output_format=mp3_44100_128")
            .addHeader("xi-api-key", BuildConfig.ELEVENLABS_API_KEY)
            .addHeader("Accept", "audio/mpeg")
            .post(body)
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("ElevenLabs HTTP ${response.code}")
            }
            val tempFile = File.createTempFile("pedidosavoz_tts_", ".mp3", context.cacheDir)
            response.body!!.byteStream().use { input ->
                tempFile.outputStream().use { output -> input.copyTo(output) }
            }
            return tempFile
        }
    }

    private suspend fun reproducir(file: File) {
        suspendCancellableCoroutine<Unit> { continuation ->
            val player = MediaPlayer()
            try {
                player.setDataSource(file.absolutePath)
                player.setOnCompletionListener {
                    it.release()
                    if (continuation.isActive) continuation.resume(Unit)
                }
                player.setOnErrorListener { mp, what, extra ->
                    mp.release()
                    if (continuation.isActive) {
                        continuation.resumeWithException(IllegalStateException("MediaPlayer error $what/$extra"))
                    }
                    true
                }
                player.prepare()
                player.start()
                continuation.invokeOnCancellation { player.release() }
            } catch (e: Throwable) {
                player.release()
                if (continuation.isActive) continuation.resumeWithException(e)
            }
        }
    }
}
