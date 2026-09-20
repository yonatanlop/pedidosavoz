package com.pedidosavoz.app.voice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Handler
import android.os.Looper

/**
 * SpeechRecognizer no enruta el audio a un headset Bluetooth conectado
 * automaticamente: hay que activar el modo SCO explicitamente y esperar
 * la confirmacion antes de empezar a escuchar.
 */
class BluetoothScoHelper(private val context: Context) {

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var receiver: BroadcastReceiver? = null
    private val timeoutHandler = Handler(Looper.getMainLooper())

    fun start(onReady: () -> Unit) {
        if (!audioManager.isBluetoothScoAvailableOffCall) {
            onReady()
            return
        }

        var notificado = false
        fun notificarUnaVez() {
            if (!notificado) {
                notificado = true
                onReady()
            }
        }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val state = intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1)
                if (state == AudioManager.SCO_AUDIO_STATE_CONNECTED) {
                    timeoutHandler.removeCallbacksAndMessages(null)
                    notificarUnaVez()
                }
            }
        }
        context.registerReceiver(receiver, IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED))

        @Suppress("DEPRECATION")
        audioManager.startBluetoothSco()
        @Suppress("DEPRECATION")
        audioManager.isBluetoothScoOn = true

        // Si el headset no confirma a tiempo, seguimos con el microfono del telefono.
        timeoutHandler.postDelayed({ notificarUnaVez() }, 3000)
    }

    fun stop() {
        timeoutHandler.removeCallbacksAndMessages(null)
        receiver?.let {
            runCatching { context.unregisterReceiver(it) }
            receiver = null
        }
        @Suppress("DEPRECATION")
        audioManager.stopBluetoothSco()
        @Suppress("DEPRECATION")
        audioManager.isBluetoothScoOn = false
    }
}
