package com.pedidosavoz.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionManager(context: Context) {

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "pedidosavoz_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var meseraNombre: String?
        get() = prefs.getString(KEY_MESERA_NOMBRE, null)
        set(value) = prefs.edit().putString(KEY_MESERA_NOMBRE, value).apply()

    fun isLoggedIn(): Boolean = !token.isNullOrBlank()

    fun clearSession() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_MESERA_NOMBRE).apply()
    }

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_TOKEN = "token"
        private const val KEY_MESERA_NOMBRE = "mesera_nombre"

        // 10.0.2.2 es el alias del emulador de Android hacia el localhost de la maquina host.
        const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000/"
    }
}
