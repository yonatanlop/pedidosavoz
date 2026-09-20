package com.pedidosavoz.app.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

sealed class VoiceState {
    object Idle : VoiceState()
    object Listening : VoiceState()
    data class Result(val texto: String) : VoiceState()
    data class Error(val mensaje: String) : VoiceState()
}

class VoiceRecognizer(
    private val context: Context,
    private val onState: (VoiceState) -> Unit
) {
    private var recognizer: SpeechRecognizer? = null
    private val scoHelper = BluetoothScoHelper(context)

    fun start() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onState(VoiceState.Error("El reconocimiento de voz no esta disponible en este dispositivo"))
            return
        }
        scoHelper.start { iniciarEscucha() }
    }

    private fun iniciarEscucha() {
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
                    detener()
                }

                override fun onError(error: Int) {
                    onState(VoiceState.Error(mensajeError(error)))
                    detener()
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

    fun detener() {
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
