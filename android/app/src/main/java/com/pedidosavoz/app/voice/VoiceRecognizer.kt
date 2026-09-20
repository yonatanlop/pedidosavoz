package com.pedidosavoz.app.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

sealed class VoiceState {
    object Idle : VoiceState()
    object Listening : VoiceState()
    data class Result(val texto: String) : VoiceState()
    data class Error(val mensaje: String) : VoiceState()
}

/**
 * @param continuo si es true, se reinicia solo tras cada resultado/error
 * (modo "manos libres" para cocina) en vez de detenerse tras un solo intento.
 */
class VoiceRecognizer(
    private val context: Context,
    private val continuo: Boolean = false,
    private val onState: (VoiceState) -> Unit
) {
    private var recognizer: SpeechRecognizer? = null
    private val scoHelper = BluetoothScoHelper(context)
    private val handler = Handler(Looper.getMainLooper())
    private var activo = false

    fun start() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onState(VoiceState.Error("El reconocimiento de voz no esta disponible en este dispositivo"))
            return
        }
        activo = true
        scoHelper.start { iniciarEscucha() }
    }

    private fun iniciarEscucha() {
        if (!activo) return
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    onState(VoiceState.Listening)
                }

                override fun onResults(results: Bundle?) {
                    val texto = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        .orEmpty()
                    onState(
                        if (texto.isBlank()) VoiceState.Error("No se entendio el pedido, intenta de nuevo")
                        else VoiceState.Result(texto)
                    )
                    continuarOFrenar()
                }

                override fun onError(error: Int) {
                    onState(VoiceState.Error(mensajeError(error)))
                    continuarOFrenar()
                }

                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            }
            startListening(intent)
        }
    }

    private fun continuarOFrenar() {
        recognizer?.destroy()
        recognizer = null
        if (continuo && activo) {
            // Pequena pausa antes de re-arrancar: evita un bucle apretado de
            // errores (por ejemplo ERROR_NO_MATCH en silencio) y le da tiempo
            // al sistema de reconocimiento a liberarse entre intentos.
            handler.postDelayed({ iniciarEscucha() }, 400)
        } else {
            detener()
        }
    }

    fun detener() {
        activo = false
        handler.removeCallbacksAndMessages(null)
        scoHelper.stop()
        recognizer?.destroy()
        recognizer = null
    }

    private fun mensajeError(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "No se entendio el pedido, intenta de nuevo"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No se detecto voz, intenta de nuevo"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Error de red en el reconocimiento de voz"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Falta el permiso de microfono"
        else -> "Error de reconocimiento de voz ($error)"
    }
}
