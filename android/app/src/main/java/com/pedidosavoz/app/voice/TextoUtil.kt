package com.pedidosavoz.app.voice

/** Minuscula y sin tildes, para comparar frases reconocidas por voz sin depender de como las transcribio el motor. */
fun normalizarTexto(texto: String): String = texto.lowercase()
    .replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")

private val PALABRAS_VACIAS = setOf(
    "la", "el", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "y", "con", "por", "favor", "para", "me", "trae", "traeme", "quiero"
)

private fun palabrasClave(frase: String): Set<String> =
    normalizarTexto(frase)
        .split(Regex("[^a-z0-9]+"))
        .filter { it.length > 2 && it !in PALABRAS_VACIAS }
        .toSet()

/**
 * true si el texto de un pedido dictado parece mencionar un plato dado —
 * cuando la mayoria (60%+) de las palabras significativas del nombre del
 * plato tambien aparecen en el pedido. Tolera texto libre dictado por voz
 * en vez de exigir una coincidencia exacta.
 */
fun pedidoMencionaPlato(textoPedido: String, nombrePlato: String): Boolean {
    val clavesPlato = palabrasClave(nombrePlato)
    if (clavesPlato.isEmpty()) return false
    val clavesPedido = palabrasClave(textoPedido)
    val coincidencias = clavesPlato.count { it in clavesPedido }
    return coincidencias.toDouble() / clavesPlato.size >= 0.6
}
