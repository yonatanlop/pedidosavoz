package com.pedidosavoz.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pedidosavoz.app.data.AgotadoRequest
import com.pedidosavoz.app.data.ApiClient
import com.pedidosavoz.app.data.PedidoResponse
import com.pedidosavoz.app.data.SessionManager
import com.pedidosavoz.app.voice.Anunciador
import com.pedidosavoz.app.voice.VoiceState
import com.pedidosavoz.app.voice.normalizarTexto
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class CocinaViewModel(application: Application) : AndroidViewModel(application) {

    private val session = SessionManager(application)
    private val anunciador = Anunciador(application)

    var activa by mutableStateOf(false)
        private set
    var pendientes by mutableStateOf<List<PedidoResponse>>(emptyList())
        private set
    var apartados by mutableStateOf<List<PedidoResponse>>(emptyList())
        private set
    var mensaje by mutableStateOf<String?>(null)
    var voiceState by mutableStateOf<VoiceState>(VoiceState.Idle)

    private var pollingJob: Job? = null
    private var ultimoRecordatorio = 0L

    fun activar() {
        activa = true
        mensaje = null
        if (pollingJob?.isActive != true) {
            ultimoRecordatorio = System.currentTimeMillis()
            pollingJob = viewModelScope.launch {
                while (true) {
                    cargarPendientes()
                    recordarApartados()
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
            val response = api.listarPedidos("pendiente", apartado = false)
            if (response.isSuccessful) {
                pendientes = response.body().orEmpty()
            }
            val respuestaApartados = api.listarPedidos("pendiente", apartado = true)
            if (respuestaApartados.isSuccessful) {
                apartados = respuestaApartados.body().orEmpty()
            }
        } catch (e: Exception) {
            // Silencioso: se reintenta en el proximo ciclo de sondeo.
        }
    }

    // Cada 10 minutos recuerda por voz que hay apartados sin atender.
    private fun recordarApartados() {
        if (apartados.isEmpty()) {
            ultimoRecordatorio = System.currentTimeMillis()
            return
        }
        if (System.currentTimeMillis() - ultimoRecordatorio >= INTERVALO_RECORDATORIO_MS) {
            ultimoRecordatorio = System.currentTimeMillis()
            val n = apartados.size
            anunciador.decir(
                if (n == 1) "Atencion, hay un apartado sin atender"
                else "Atencion, hay $n apartados sin atender"
            )
        }
    }

    fun procesarFrase(texto: String) {
        val normalizado = normalizarTexto(texto)
        val trigger = TRIGGERS_AGOTADO.firstOrNull { normalizado.contains(it) }
        if (trigger != null) {
            val plato = normalizado.substringAfter(trigger).trim()
            if (plato.isBlank()) {
                mensaje = "Dime que plato se acabo, por ejemplo \"se acabo la sopa\""
            } else {
                marcarAgotado(plato)
            }
            return
        }

        if (normalizado.contains("apartad")) {
            procesarApartadoListo(normalizado.substringAfter("apartad"))
            return
        }

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

    // "apartado 3 listo": marca como listo el apartado con ese numero.
    private fun procesarApartadoListo(resto: String) {
        val numero = extraerNumeroPedido(resto)
        if (numero == null) {
            mensaje = "Dime el numero del apartado, por ejemplo \"apartado 3 listo\""
            return
        }
        val apartado = apartados.filter { it.numero_apartado == numero }.maxByOrNull { it.id }
        if (apartado == null) {
            mensaje = "No hay un apartado pendiente #$numero"
            return
        }
        marcarListo(apartado)
    }

    private fun marcarAgotado(nombrePlato: String) {
        viewModelScope.launch {
            try {
                val api = ApiClient.create(session.serverUrl)
                val response = api.marcarAgotado(AgotadoRequest(nombrePlato))
                if (response.isSuccessful) {
                    mensaje = "Marcado como agotado: $nombrePlato"
                } else {
                    mensaje = "No se pudo marcar agotado \"$nombrePlato\" (${response.code()})"
                }
            } catch (e: Exception) {
                mensaje = "No se pudo marcar agotado: ${e.message ?: e::class.simpleName}"
            }
        }
    }

    fun marcarListo(pedido: PedidoResponse) {
        viewModelScope.launch {
            try {
                val api = ApiClient.create(session.serverUrl)
                val response = api.marcarListo(pedido.id)
                if (response.isSuccessful) {
                    mensaje = if (pedido.apartado) "Apartado #${pedido.numero_apartado} marcado como listo"
                    else "Pedido #${pedido.numero_turno} marcado como listo"
                    pendientes = pendientes.filter { it.id != pedido.id }
                    apartados = apartados.filter { it.id != pedido.id }
                } else {
                    mensaje = "No se pudo marcar el pedido #${pedido.numero_turno} (${response.code()})"
                }
            } catch (e: Exception) {
                mensaje = "No se pudo marcar el pedido: ${e.message ?: e::class.simpleName}"
            }
        }
    }

    override fun onCleared() {
        anunciador.apagar()
        super.onCleared()
    }

    companion object {
        private const val INTERVALO_RECORDATORIO_MS = 10 * 60 * 1000L
        private val TRIGGERS_AGOTADO = listOf("se acabo", "se termino", "ya no hay")

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
            val normalizado = normalizarTexto(texto)

            Regex("\\d+").find(normalizado)?.let { return it.value.toIntOrNull() }

            for (palabra in normalizado.split(Regex("\\s+"))) {
                NUMEROS_TEXTO[palabra]?.let { return it }
            }
            return null
        }
    }
}
