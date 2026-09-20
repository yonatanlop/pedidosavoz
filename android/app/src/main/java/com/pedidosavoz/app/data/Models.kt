package com.pedidosavoz.app.data

data class RegistroRequest(val nombre: String)

data class Mesera(val id: Int, val nombre: String, val usuario: String)

data class RegistroResponse(val token: String, val mesera: Mesera)

data class PedidoRequest(val texto_pedido: String)

data class PedidoResponse(
    val id: Int,
    val texto_pedido: String,
    val estado: String,
    val fecha: String,
    val hora_creacion: String
)
