package com.pedidosavoz.app.data

data class LoginRequest(val usuario: String, val password: String)

data class Mesera(val id: Int, val nombre: String, val usuario: String)

data class LoginResponse(val token: String, val mesera: Mesera)

data class PedidoRequest(val texto_pedido: String)

data class PedidoResponse(
    val id: Int,
    val texto_pedido: String,
    val estado: String,
    val fecha: String,
    val hora_creacion: String
)
