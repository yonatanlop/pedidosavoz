# PedidosVoz - Android

App Kotlin (Jetpack Compose) para que las meseras dicten el pedido por voz.

## Flujo

1. **Registro por nombre**: al abrir la app por primera vez, pide solo el nombre de la mesera (sin usuario ni contrasena) y llama a `POST /api/auth/registro`. El backend crea la cuenta y devuelve un token JWT de larga duracion (180 dias) que se guarda cifrado en el dispositivo (`EncryptedSharedPreferences`) — no vuelve a pedir el nombre hasta que alguien presione "Salir" (util si varias meseras comparten un mismo telefono/tablet).
2. **Pantalla de pedido**: boton de microfono grande que usa `SpeechRecognizer` de Android para dictar el pedido.
3. El texto reconocido se muestra editable para corregirlo antes de enviarlo.
4. Al presionar "Enviar pedido" se llama a `POST /api/pedidos` con el token de la mesera. El backend lo emite por Socket.io y aparece en el tablero web al instante, junto con el nombre de quien lo hizo.

## Modo cocina

Desde la pantalla de registro, el enlace "Modo cocina" entra a una pantalla separada pensada para un celular/tablet en la cocina, sin necesidad de registrarse:

- **Microfono en escucha continua** (`VoiceRecognizer` con `continuo = true`): tras cada resultado o error se reinicia solo (con una pausa de 400ms) en vez de detenerse, para que cocina tenga las manos completamente libres.
- Al reconocer una frase, `CocinaViewModel.extraerNumeroPedido` busca un numero (digito o palabra en espanol: "uno".."treinta") en el texto reconocido, y si hay un pedido pendiente con ese `numero_turno`, lo marca como listo automaticamente (`PATCH /api/pedidos/:id/listo`) — decir "pedido tres listo" o simplemente "tres" funciona igual.
- La lista de pedidos pendientes se muestra en pantalla (sondeada cada 4 segundos vía `GET /api/pedidos?estado=pendiente`, sin Socket.io en el cliente Android) con un boton "Pedido #N listo" por si el reconocimiento de voz falla o hay mucho ruido — sirve como respaldo tactil y como pantalla de cocina por si misma.
- "Salir" detiene el microfono y el sondeo, y vuelve a la pantalla de registro.

## Manos libres (headset Bluetooth)

`SpeechRecognizer` no enruta el audio a un headset Bluetooth conectado automaticamente. `voice/BluetoothScoHelper.kt` activa el modo SCO del `AudioManager` y espera la confirmacion de conexion (con un timeout de 3s como respaldo) antes de empezar a escuchar, para que la mesera pueda dictar el pedido con el manos libres puesto. Si no hay headset conectado, usa el microfono del telefono normalmente.

## Configurar el servidor

La URL del backend es configurable desde la pantalla de registro ("Configurar servidor"), se guarda en el dispositivo. Por defecto apunta a `http://10.0.2.2:3000/` (alias del emulador de Android hacia el backend corriendo en la maquina host vía Docker).

Para un dispositivo fisico en la misma red que el backend en desarrollo, usar la IP de la maquina (ej. `http://192.168.1.50:3000/`).

**En producción, usar `https://pedidoavoz.duckdns.org/`** (nota la barra final) — el backend esta desplegado en Oracle Cloud detras de HTTPS (ver [../deploy/shared-caddy.md](../deploy/shared-caddy.md)), no en el puerto 3000 directo. Las peticiones `api/...` de la app llegan a `nginx`, que las reenvia al backend internamente, igual que en local.

**Nota de seguridad**: el manifest tiene `usesCleartextTraffic="true"` para permitir HTTP plano solo hacia el backend de desarrollo (`10.0.2.2` o una IP local). El endpoint de producción ya usa HTTPS real.

## Compilar

Requiere Android Studio (o el SDK + JDK 17 por linea de comandos) con `compileSdk`/`platform android-35` instalado.

```bash
cd android
./gradlew assembleDebug
```

El APK queda en `app/build/outputs/apk/debug/app-debug.apk`.

Para instalar en un emulador o dispositivo conectado:

```bash
./gradlew installDebug
```

Las meseras no necesitan que nadie les cree una cuenta de antemano: se registran ellas mismas la primera vez que abren la app, solo con su nombre.

`POST /api/auth/register` (protegido con `ADMIN_KEY`) y `POST /api/auth/login` (usuario+contrasena) siguen existiendo en el backend para un eventual panel de administracion, pero la app de Android ya no los usa.

## Estado de las pruebas

Compilado y verificado en el emulador `Pixel_6_API_35` (arranca, la pantalla de registro renderiza correctamente con el campo de nombre y el boton). El entorno de desarrollo usado para este commit no tenia aceleracion grafica disponible para el emulador, asi que el flujo interactivo completo (registro, dictado por voz, manos libres) no se pudo probar de punta a punta ahi — falta validarlo en un emulador con GPU o, mejor, en un dispositivo Android fisico real (recomendado especialmente para el dictado por voz y el headset Bluetooth).
