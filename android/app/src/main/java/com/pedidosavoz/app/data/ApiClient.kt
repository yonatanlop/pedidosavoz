package com.pedidosavoz.app.data

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun create(baseUrl: String): ApiService {
        var normalizada = baseUrl.trim()
        if (!normalizada.startsWith("http://") && !normalizada.startsWith("https://")) {
            normalizada = "https://$normalizada"
        }
        if (!normalizada.endsWith("/")) {
            normalizada = "$normalizada/"
        }
        return Retrofit.Builder()
            .baseUrl(normalizada)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
