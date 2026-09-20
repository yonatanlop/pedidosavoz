# PedidosVoz - Backend

API REST + Socket.io para el sistema de pedidos por voz.

## Correr en local con Docker

```bash
cp .env.example .env                  # credenciales de Postgres (raiz del repo)
cp backend/.env.example backend/.env  # JWT_SECRET, ADMIN_KEY, etc.

docker compose up --build
```

**Importante**: `DB_NAME`/`DB_USER`/`DB_PASSWORD` de `backend/.env` se ignoran al correr con `docker-compose.yml` — `docker-compose.yml` los inyecta el mismo desde el `.env` de la raiz para que backend y Postgres siempre usen las mismas credenciales. Si cambias la contraseña, hazlo en el `.env` de la raiz.

Esto levanta PostgreSQL (con el esquema de `src/db/init.sql` ya aplicado) y el backend en `http://localhost:3000`.

Para crear una mesera de prueba una vez que los contenedores estén arriba:

```bash
docker compose exec backend npm run seed
```

### Aplicar cambios de esquema a una base de datos ya existente

`src/db/init.sql` solo se aplica en un volumen nuevo. Si ya tienes datos y se agregan columnas nuevas (como `turno`/`numero_turno`), aplica la migracion idempotente:

```bash
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -f - < backend/src/db/migrate.sql
```

## Correr sin Docker (desarrollo)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Requiere una instancia de PostgreSQL accesible con las variables de `.env`, y el esquema de `src/db/init.sql` aplicado manualmente:

```bash
psql "$DATABASE_URL" -f src/db/init.sql
```

## Endpoints

### Auth

- `POST /api/auth/registro` — **usado por la app Android**. Autoregistro solo con nombre, sin password.
  Body: `{ "nombre": "Juana Perez" }` → `{ token, mesera }`. El `usuario` se genera automaticamente (slug del nombre + sufijo si ya existe) y el token dura 180 dias.
- `POST /api/auth/register` — crea una mesera con usuario/password (pensado para un futuro panel de administracion, la app no lo usa). Requiere header `x-admin-key: <ADMIN_KEY>`.
  Body: `{ "nombre": "Juana Perez", "usuario": "juana", "password": "..." }`
- `POST /api/auth/login` — usuario/password (idem, no usado por la app). Body: `{ "usuario": "juana", "password": "..." }` → `{ token, mesera }`

### Pedidos

- `POST /api/pedidos` — crea un pedido (usado por la app Android). Requiere `Authorization: Bearer <token>`.
  Body: `{ "texto_pedido": "una arepa con queso y un cafe con leche" }`. La respuesta incluye `turno` (`"desayuno"` o `"almuerzo"`, segun la hora local y el corte configurado en `TURNO_ALMUERZO_DESDE`) y `numero_turno` (correlativo que reinicia en 1 en cada turno y cada dia).
- `GET /api/pedidos?estado=pendiente&fecha=2026-09-19` — lista pedidos (usado por la pantalla web: tablero con `estado=pendiente`, historial con `estado=listo`). Filtros opcionales.
- `PATCH /api/pedidos/:id/listo` — marca un pedido como listo (usado por la pantalla de cocina). Guarda `listo_en` con la fecha/hora local de despacho.

### Tiempo real (Socket.io)

- Evento `pedido:nuevo` — se emite al crear un pedido, con el pedido completo.
- Evento `pedido:listo` — se emite al marcar un pedido listo, con `{ id }`.

## Variables de entorno

Ver `.env.example`.
