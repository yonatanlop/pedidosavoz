# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Idioma: el usuario trabaja en español latino. Responde siempre en español (nunca en inglés); el código, la UI y la documentación del proyecto también están en español.

## Qué es

Pedidos de desayuno/almuerzo dictados por voz. La mesera dicta el pedido en una app Android → el backend lo guarda y lo emite por Socket.io → el tablero web de cocina lo muestra en tiempo real → cocina lo marca como listo (por botón, o por voz desde el "Modo cocina" de la app). Producción: https://pedidoavoz.duckdns.org/ (Oracle Cloud, detrás de Caddy; ver `deploy/shared-caddy.md`).

## Componentes y comandos

Tres piezas independientes; no hay tests ni linter configurados en ninguna.

**Todo local (Docker)** — desde la raíz:
```bash
cp .env.example .env && cp backend/.env.example backend/.env
docker compose up --build            # backend :3000, web :8090, postgres :5432
docker compose exec backend npm run seed   # crea una mesera de prueba
```
- `DB_*` de `backend/.env` se ignoran con docker-compose: las credenciales de Postgres se toman del `.env` de la raíz.
- `backend/src/db/init.sql` solo se aplica en un volumen nuevo. Para bases existentes, cambios de esquema van en `backend/src/db/migrate.sql` (idempotente): `docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -f - < backend/src/db/migrate.sql`. Al cambiar el esquema, actualiza ambos archivos.
- `docker-compose.deploy.yml` y `deploy/` son para el despliegue en OCI.

**Backend** (`backend/`, Node + Express + Socket.io + pg, CommonJS): `npm run dev` (nodemon), `npm start`, `npm run seed`. Necesita PostgreSQL accesible.

**Web** (`web/`): HTML/JS plano sin build; nginx sirve `public/` y hace proxy de `/api/*` y `/socket.io/*` al backend (`nginx.conf`), por eso el navegador usa un solo origen. `package.json` solo existe para obtener el bundle de socket.io-client.

**Android** (`android/`, Kotlin + Compose, package `com.pedidosavoz.app`): `cd android && ./gradlew assembleDebug` / `installDebug`. Requiere JDK 17 y `platform android-35`. URL del backend configurable en la app; por defecto `http://10.0.2.2:3000/`, en producción `https://pedidoavoz.duckdns.org/` (con barra final).

## Arquitectura (lo que cruza archivos)

- **Backend**: `app.js` (`createApp(io)`) monta `routes/` → `controllers/`; los routers de pedidos y agotados reciben `io` para emitir eventos (`pedido:nuevo`, `pedido:listo`, `agotado:nuevo`). `sockets/index.js` solo registra conexiones.
- **Auth**: la app Android usa `POST /api/auth/registro` (solo nombre, sin password, JWT de 180 días guardado en `EncryptedSharedPreferences`). `/register` (con `x-admin-key`) y `/login` existen pero la app no los usa. Marcar listo (`PATCH /api/pedidos/:id/listo`) y `/api/agotados` son **sin auth** a propósito.
- **Turno y número de pedido**: los calcula el backend en SQL al insertar (`CURRENT_TIME >= TURNO_ALMUERZO_DESDE` → `almuerzo`, si no `desayuno`; `numero_turno` = max del día+turno + 1). Reinicia en 1 por turno y día. Cocina se refiere a los pedidos por ese número ("pedido tres listo").
- **Fechas**: `listo_en` se serializa con `to_char` para evitar que node-postgres lo reinterprete con la zona horaria del proceso Node; mantén ese patrón al agregar columnas `TIMESTAMP` sin zona.
- **Android — dos flujos**: `PedidoViewModel`/`PedidoScreen` (mesera: dicta, edita, envía) y `CocinaViewModel`/`CocinaScreen` (cocina: escucha continua, sin registro). Cocina **sondea** `GET /api/pedidos?estado=pendiente` cada 4 s; el cliente Android no usa Socket.io (solo la web).
- **Voz** (`voice/`): `VoiceRecognizer` (`SpeechRecognizer`; modo `continuo` se reinicia solo para cocina), `BluetoothScoHelper` (activa SCO para headset antes de escuchar, timeout 3 s), `Anunciador` (TTS **nativo de Android**, `es-CO` con fallback a `es`; se descartó ElevenLabs porque las voces en español devuelven 402 por API), `TextoUtil` (coincidencia de plato agotado: ≥60 % de palabras significativas).
- **Platos agotados**: en Modo cocina, frases "se acabó/se terminó/ya no hay X" → `POST /api/agotados` en vez de marcar pedido listo. Antes de enviar, `PedidoViewModel.enviarPedido` consulta `GET /api/agotados` (son por día, no se "reponen"), avisa por voz y bloquea el envío con diálogo "Editar" / "Enviar igual"; el aviso nombra a la mesera.

- **Apartados y online**: `pedidos.apartado=true` (dictado que empieza con "apartado", o pedido online) usa `numero_apartado` propio y `numero_turno=0`. Los pedidos online van con la mesera `Mesera_Online` (se siembra en `init.sql`/`migrate.sql`), `origen='online'` y límite por IP (`MAX_ONLINE_POR_IP`, depende de `TRUST_PROXY`). El menú vive en `menu_items` (imágenes en BYTEA); "agotado" de un item se calcula contra la tabla `agotados` del día, así que lo que cocina dice por voz también lo bloquea en `pedir.html`. `pedir.html` y `admin-menu.html` no se enlazan desde el tablero a propósito. Cualquier cliente que liste pedidos y no entienda apartados debe pasar `apartado=false`.

La documentación detallada de cada pieza está en `README.md`, `backend/README.md`, `web/README.md` y `android/README.md`; mantenlos sincronizados al cambiar endpoints, eventos o flujos.
