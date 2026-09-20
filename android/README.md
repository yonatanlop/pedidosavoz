# PedidosVoz - Android

App Kotlin (Jetpack Compose) para que las meseras dicten el pedido por voz.

## Flujo

1. **Login** contra `POST /api/auth/login`. El token JWT y el nombre de la mesera se guardan cifrados en el dispositivo (`EncryptedSharedPreferences`).
2. **Pantalla de pedido**: boton de microfono grande que usa `SpeechRecognizer` de Android para dictar el pedido.
3. El texto reconocido se muestra editable para corregirlo antes de enviarlo.
4. Al presionar "Enviar pedido" se llama a `POST /api/pedidos` con el token de la mesera. El backend lo emite por Socket.io y aparece en el tablero web al instante.

## Manos libres (headset Bluetooth)

`SpeechRecognizer` no enruta el audio a un headset Bluetooth conectado automaticamente. `voice/BluetoothScoHelper.kt` activa el modo SCO del `AudioManager` y espera la confirmacion de conexion (con un timeout de 3s como respaldo) antes de empezar a escuchar, para que la mesera pueda dictar el pedido con el manos libres puesto. Si no hay headset conectado, usa el microfono del telefono normalmente.

## Configurar el servidor

La URL del backend es configurable desde la pantalla de login ("Configurar servidor"), se guarda en el dispositivo. Por defecto apunta a `http://10.0.2.2:3000/` (alias del emulador de Android hacia el backend corriendo en la maquina host vía Docker).

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

## Crear una mesera de prueba

Con el backend corriendo (ver [../backend/README.md](../backend/README.md)):

```bash
docker compose exec backend npm run seed
```

Usuario: `demo` / contrasena: `demo1234`.

En producción ya existe esta misma cuenta demo para pruebas — crear las cuentas reales de las meseras vía `POST /api/auth/register` (requiere el `ADMIN_KEY` configurado en el servidor) y considerar eliminar o cambiar la contrasena de la cuenta demo antes de uso real.

## Estado de las pruebas

Compilado y verificado en el emulador `Pixel_6_API_35` (arranca, la pantalla de login renderiza correctamente con los campos y el boton). El entorno de desarrollo usado para este commit no tenia aceleracion grafica disponible para el emulador, asi que el flujo interactivo completo (login, dictado por voz, manos libres) no se pudo probar de punta a punta ahi — falta validarlo en un emulador con GPU o, mejor, en un dispositivo Android fisico real (recomendado especialmente para el dictado por voz y el headset Bluetooth).
