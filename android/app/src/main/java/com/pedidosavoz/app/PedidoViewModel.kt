package com.pedidosavoz.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pedidosavoz.app.data.ApiClient
import com.pedidosavoz.app.data.PedidoRequest
import com.pedidosavoz.app.data.RegistroRequest
import com.pedidosavoz.app.data.SessionManager
import com.pedidosavoz.app.voice.VoiceState
import kotlinx.coroutines.launch

class PedidoViewModel(application: Application) : AndroidViewModel(application) {

    val session = SessionManager(application)

    var loggedIn by mutableStateOf(session.isLoggedIn())
        private set
    var meseraNombre by mutableStateOf(session.meseraNombre.orEmpty())
        private set
    var serverUrl by mutableStateOf(session.serverUrl)
        private set
    var registroLoading by mutableStateOf(false)
        private set
    var registroError by mutableStateOf<String?>(null)
        private set

    var voiceState by mutableStateOf<VoiceState>(VoiceState.Idle)
    var textoPedido by mutableStateOf("")
    var enviando by mutableStateOf(false)
        private set
    var mensaje by mutableStateOf<String?>(null)

    fun actualizarServerUrl(url: String) {
        serverUrl = url
        session.serverUrl = url
    }

    fun registrarse(nombre: String) {
        if (nombre.isBlank()) return

        registroLoading = true
        registroError = null
        viewModelScope.launch {
            try {
                val api = ApiClient.create(session.serverUrl)
                val response = api.registrar(RegistroRequest(nombre))
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    session.token = body.token
                    session.meseraNombre = body.mesera.nombre
                    meseraNombre = body.mesera.nombre
                    loggedIn = true
                } else {
                    registroError = "No se pudo registrar, intenta de nuevo"
                }
            } catch (e: Exception) {
                registroError = "No se pudo conectar: ${e.message ?: e::class.simpleName}"
            } finally {
                registroLoading = false
            }
        }
    }

    fun enviarPedido() {
        val token = session.token ?: return
        val texto = textoPedido.trim()
        if (texto.isEmpty()) return

        enviando = true
        mensaje = null
        viewModelScope.launch {
            try {
                val api = ApiClient.create(session.serverUrl)
                val response = api.crearPedido("Bearer $token", PedidoRequest(texto))
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    mensaje = "Pedido #${body.numero_turno} enviado"
                    textoPedido = ""
                    voiceState = VoiceState.Idle
                } else {
                    mensaje = "No se pudo enviar el pedido (${response.code()})"
                }
            } catch (e: Exception) {
                mensaje = "No se pudo enviar el pedido: ${e.message ?: e::class.simpleName}"
            } finally {
                enviando = false
            }
        }
    }

    fun descartarPedido() {
        textoPedido = ""
        voiceState = VoiceState.Idle
        mensaje = null
    }

    fun cerrarSesion() {
        session.clearSession()
        loggedIn = false
        textoPedido = ""
        voiceState = VoiceState.Idle
        mensaje = null
    }
}
