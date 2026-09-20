package com.pedidosavoz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pedidosavoz.app.data.PedidoResponse
import com.pedidosavoz.app.voice.VoiceState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CocinaScreen(
    pendientes: List<PedidoResponse>,
    voiceState: VoiceState,
    mensaje: String?,
    onMarcarListo: (PedidoResponse) -> Unit,
    onSalir: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Modo cocina") },
                actions = {
                    TextButton(onClick = onSalir) { Text("Salir") }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            val estadoTexto = when (voiceState) {
                is VoiceState.Listening -> "Escuchando... di \"pedido [numero] listo\""
                is VoiceState.Error -> voiceState.mensaje
                else -> "Preparando el microfono..."
            }
            Text(estadoTexto, style = MaterialTheme.typography.titleMedium)

            if (mensaje != null) {
                Spacer(Modifier.height(6.dp))
                Text(mensaje, color = MaterialTheme.colorScheme.primary)
            }

            Spacer(Modifier.height(16.dp))

            if (pendientes.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No hay pedidos pendientes", style = MaterialTheme.typography.bodyLarge)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(pendientes, key = { it.id }) { pedido ->
                        TarjetaPedidoCocina(pedido, onMarcarListo)
                    }
                }
            }
        }
    }
}

@Composable
private fun TarjetaPedidoCocina(pedido: PedidoResponse, onMarcarListo: (PedidoResponse) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "${if (pedido.turno == "almuerzo") "Almuerzo" else "Desayuno"} #${pedido.numero_turno}",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(pedido.hora_creacion.take(5), color = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.height(4.dp))
            Text(pedido.mesera.nombre, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
            Text(pedido.texto_pedido, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(12.dp))
            Button(onClick = { onMarcarListo(pedido) }, modifier = Modifier.fillMaxWidth()) {
                Text("Pedido #${pedido.numero_turno} listo")
            }
        }
    }
}
