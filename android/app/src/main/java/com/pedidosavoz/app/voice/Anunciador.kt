package com.pedidosavoz.app.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Anuncia frases cortas por voz usando el motor de texto a voz nativo de
 * Android, en espanol.
 *
 * Se probo ElevenLabs primero (mismo servicio que el proyecto
 * AsistentePersonal), pero las unicas voces "premade" garantizadas en su
 * plan gratis son todas en ingles (acento americano/britanico/australiano) —
 * sonaban con acento extranjero al leer espanol. Las voces en espanol de su
 * biblioteca (incluida una colombiana) devuelven HTTP 402: solo se pueden
 * usar por API con plan pago. Por eso se uso el motor nativo: gratis, sin
 * conexion, y con la voz/acento en espanol que ya tenga instalada el
 * telefono.
 */
class Anunciador(context: Context) {

    private var tts: TextToSpeech? = null
    private var listo = false
    private val pendientes = mutableListOf<String>()

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val resultado = tts?.setLanguage(Locale("es", "CO"))
                if (resultado == TextToSpeech.LANG_MISSING_DATA || resultado == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts?.setLanguage(Locale("es"))
                }
                listo = true
                pendientes.forEach { reproducir(it) }
                pendientes.clear()
            }
        }
    }

    fun decir(texto: String) {
        if (texto.isBlank()) return
        if (listo) reproducir(texto) else pendientes.add(texto)
    }

    private fun reproducir(texto: String) {
        tts?.speak(texto, TextToSpeech.QUEUE_ADD, null, null)
    }

    fun apagar() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
