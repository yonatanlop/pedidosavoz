package com.pedidosavoz.app.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/pedidos")
    suspend fun crearPedido(
        @Header("Authorization") authorization: String,
        @Body request: PedidoRequest
    ): Response<PedidoResponse>
}
