package com.pedidosavoz.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.pedidosavoz.app.ui.PedidoScreen
import com.pedidosavoz.app.ui.RegistroScreen
import com.pedidosavoz.app.ui.theme.PedidosVozTheme
import com.pedidosavoz.app.voice.VoiceRecognizer
import com.pedidosavoz.app.voice.VoiceState

class MainActivity : ComponentActivity() {

    private val viewModel: PedidoViewModel by viewModels()
    private var voiceRecognizer: VoiceRecognizer? = null

    private val requestMicPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) iniciarDictado() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            PedidosVozTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (viewModel.loggedIn) {
                        PedidoScreen(
                            meseraNombre = viewModel.meseraNombre,
                            voiceState = viewModel.voiceState,
                            textoPedido = viewModel.textoPedido,
                            onTextoPedidoChange = { viewModel.textoPedido = it },
                            enviando = viewModel.enviando,
                            mensaje = viewModel.mensaje,
                            onDictar = { solicitarPermisoYDictar() },
                            onEnviar = { viewModel.enviarPedido() },
                            onDescartar = { viewModel.descartarPedido() },
                            onCerrarSesion = {
                                voiceRecognizer?.detener()
                                viewModel.cerrarSesion()
                            }
                        )
                    } else {
                        RegistroScreen(
                            serverUrl = viewModel.serverUrl,
                            onServerUrlChange = { viewModel.actualizarServerUrl(it) },
                            loading = viewModel.registroLoading,
                            errorMessage = viewModel.registroError,
                            onRegistrar = { nombre -> viewModel.registrarse(nombre) }
                        )
                    }
                }
            }
        }
    }

    private fun solicitarPermisoYDictar() {
        val tienePermiso = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (tienePermiso) {
            iniciarDictado()
        } else {
            requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun iniciarDictado() {
        voiceRecognizer?.detener()
        voiceRecognizer = VoiceRecognizer(this) { state ->
            viewModel.voiceState = state
            if (state is VoiceState.Result) {
                viewModel.textoPedido = state.texto
            }
        }
        voiceRecognizer?.start()
    }

    override fun onDestroy() {
        voiceRecognizer?.detener()
        super.onDestroy()
    }
}
