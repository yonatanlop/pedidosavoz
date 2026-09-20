package com.pedidosavoz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pedidosavoz.app.voice.VoiceState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PedidoScreen(
    meseraNombre: String,
    voiceState: VoiceState,
    textoPedido: String,
    onTextoPedidoChange: (String) -> Unit,
    enviando: Boolean,
    mensaje: String?,
    onDictar: () -> Unit,
    onEnviar: () -> Unit,
    onDescartar: () -> Unit,
    onCerrarSesion: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Hola, $meseraNombre") },
                actions = {
                    TextButton(onClick = onCerrarSesion) { Text("Salir") }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(24.dp))

            val estadoTexto = when (voiceState) {
                is VoiceState.Idle -> "Presiona el microfono y dicta el pedido"
                is VoiceState.Listening -> "Escuchando..."
                is VoiceState.Result -> "Revisa el pedido antes de enviarlo"
                is VoiceState.Error -> voiceState.mensaje
            }
            Text(estadoTexto, style = MaterialTheme.typography.titleMedium)

            Spacer(Modifier.height(24.dp))

            FilledIconButton(
                onClick = onDictar,
                modifier = Modifier.size(96.dp),
                enabled = voiceState !is VoiceState.Listening
            ) {
                Icon(
                    Icons.Filled.Mic,
                    contentDescription = "Dictar pedido",
                    modifier = Modifier.size(48.dp)
                )
            }

            Spacer(Modifier.height(32.dp))

            if (textoPedido.isNotBlank()) {
                OutlinedTextField(
                    value = textoPedido,
                    onValueChange = onTextoPedidoChange,
                    label = { Text("Pedido") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClick = onDescartar, enabled = !enviando) {
                        Text("Descartar")
                    }
                    Button(onClick = onEnviar, enabled = !enviando && textoPedido.isNotBlank()) {
                        Text(if (enviando) "Enviando..." else "Enviar pedido")
                    }
                }
            }

            if (mensaje != null) {
                Spacer(Modifier.height(16.dp))
                Text(mensaje)
            }
        }
    }
}
