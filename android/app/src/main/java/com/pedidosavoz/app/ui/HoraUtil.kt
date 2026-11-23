package com.pedidosavoz.app.ui

/**
 * Convierte la hora que entrega el backend en 24 h ("13:05" o "13:05:30.123")
 * a formato de 12 h con AM/PM ("1:05 PM"). Si no se puede interpretar, la
 * devuelve tal cual.
 */
fun formatearHora12(hora: String?): String {
    if (hora.isNullOrBlank()) return ""
    val partes = hora.split(":")
    val h24 = partes.getOrNull(0)?.toIntOrNull() ?: return hora
    val minutos = partes.getOrNull(1)?.take(2) ?: return hora
    val sufijo = if (h24 >= 12) "PM" else "AM"
    val h12 = if (h24 % 12 == 0) 12 else h24 % 12
    return "$h12:$minutos $sufijo"
}
