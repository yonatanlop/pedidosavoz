package com.pedidosavoz.app.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("api/auth/registro")
    suspend fun registrar(@Body request: RegistroRequest): Response<RegistroResponse>

    @POST("api/pedidos")
    suspend fun crearPedido(
        @Header("Authorization") authorization: String,
        @Body request: PedidoRequest
    ): Response<PedidoResponse>

    @GET("api/pedidos")
    suspend fun listarPedidos(@Query("estado") estado: String): Response<List<PedidoResponse>>

    @PATCH("api/pedidos/{id}/listo")
    suspend fun marcarListo(@Path("id") id: Int): Response<PedidoResponse>
}
