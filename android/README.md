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

Para un dispositivo fisico en la misma red que el backend en desarrollo, usar la IP de la maquina (ej. `http://192.168.1.50:3000/`). En producción, apuntar al dominio/IP de la VM de Oracle Cloud.

**Nota de seguridad**: mientras el backend no tenga HTTPS configurado (ver plan de despliegue), el manifest tiene `usesCleartextTraffic="true"` para permitir HTTP plano. Una vez el backend este detras de HTTPS en producción, cambiar esto a `false`.

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

## Estado de las pruebas

Compilado y verificado en el emulador `Pixel_6_API_35` (arranca, la pantalla de login renderiza correctamente con los campos y el boton). El entorno de desarrollo usado para este commit no tenia aceleracion grafica disponible para el emulador, asi que el flujo interactivo completo (login, dictado por voz, manos libres) no se pudo probar de punta a punta ahi — falta validarlo en un emulador con GPU o, mejor, en un dispositivo Android fisico real (recomendado especialmente para el dictado por voz y el headset Bluetooth).
