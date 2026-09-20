package com.pedidosavoz.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pedidosavoz.app.data.ApiClient
import com.pedidosavoz.app.data.PedidoResponse
import com.pedidosavoz.app.data.SessionManager
import com.pedidosavoz.app.voice.VoiceState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class CocinaViewModel(application: Application) : AndroidViewModel(application) {

    private val session = SessionManager(application)

    var activa by mutableStateOf(false)
        private set
    var pendientes by mutableStateOf<List<PedidoResponse>>(emptyList())
        private set
    var mensaje by mutableStateOf<String?>(null)
    var voiceState by mutableStateOf<VoiceState>(VoiceState.Idle)

    private var pollingJob: Job? = null

    fun activar() {
        activa = true
        mensaje = null
        if (pollingJob?.isActive != true) {
            pollingJob = viewModelScope.launch {
                while (true) {
                    cargarPendientes()
                    delay(4000)
                }
            }
        }
    }

    fun desactivar() {
        activa = false
        pollingJob?.cancel()
        pollingJob = null
        voiceState = VoiceState.Idle
    }

    private suspend fun cargarPendientes() {
        try {
            val api = ApiClient.create(session.serverUrl)
            val response = api.listarPedidos("pendiente")
            if (response.isSuccessful) {
                pendientes = response.body().orEmpty()
            }
        } catch (e: Exception) {
            // Silencioso: se reintenta en el proximo ciclo de sondeo.
        }
    }

    fun procesarFrase(texto: String) {
        val numero = extraerNumeroPedido(texto)
        if (numero == null) {
            mensaje = "No entendi un numero de pedido: \"$texto\""
            return
        }
        val pedido = pendientes.filter { it.numero_turno == numero }.minByOrNull { it.hora_creacion }
        if (pedido == null) {
            mensaje = "No hay un pedido pendiente #$numero"
            return
        }
        marcarListo(pedido)
    }

    fun marcarListo(pedido: PedidoResponse) {
        viewModelScope.launch {
            try {
                val api = ApiClient.create(session.serverUrl)
                val response = api.marcarListo(pedido.id)
                if (response.isSuccessful) {
                    mensaje = "Pedido #${pedido.numero_turno} marcado como listo"
                    pendientes = pendientes.filter { it.id != pedido.id }
                } else {
                    mensaje = "No se pudo marcar el pedido #${pedido.numero_turno} (${response.code()})"
                }
            } catch (e: Exception) {
                mensaje = "No se pudo marcar el pedido: ${e.message ?: e::class.simpleName}"
            }
        }
    }

    companion object {
        private val NUMEROS_TEXTO = mapOf(
            "cero" to 0, "un" to 1, "uno" to 1, "una" to 1, "dos" to 2, "tres" to 3, "cuatro" to 4,
            "cinco" to 5, "seis" to 6, "siete" to 7, "ocho" to 8, "nueve" to 9, "diez" to 10,
            "once" to 11, "doce" to 12, "trece" to 13, "catorce" to 14, "quince" to 15,
            "dieciseis" to 16, "diecisiete" to 17, "dieciocho" to 18, "diecinueve" to 19,
            "veinte" to 20, "veintiuno" to 21, "veintidos" to 22, "veintitres" to 23,
            "veinticuatro" to 24, "veinticinco" to 25, "veintiseis" to 26, "veintisiete" to 27,
            "veintiocho" to 28, "veintinueve" to 29, "treinta" to 30
        )

        fun extraerNumeroPedido(texto: String): Int? {
            val normalizado = texto.lowercase()
                .replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")

            Regex("\\d+").find(normalizado)?.let { return it.value.toIntOrNull() }

            for (palabra in normalizado.split(Regex("\\s+"))) {
                NUMEROS_TEXTO[palabra]?.let { return it }
            }
            return null
        }
    }
}
