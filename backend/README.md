# PedidosVoz - Backend

API REST + Socket.io para el sistema de pedidos por voz.

## Correr en local con Docker

```bash
cp backend/.env.example backend/.env
# edita backend/.env con tus valores (JWT_SECRET, ADMIN_KEY, etc.)

docker compose up --build
```

Esto levanta PostgreSQL (con el esquema de `src/db/init.sql` ya aplicado) y el backend en `http://localhost:3000`.

Para crear una mesera de prueba una vez que los contenedores estén arriba:

```bash
docker compose exec backend npm run seed
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

- `POST /api/auth/register` — crea una mesera. Requiere header `x-admin-key: <ADMIN_KEY>`.
  Body: `{ "nombre": "Juana Perez", "usuario": "juana", "password": "..." }`
- `POST /api/auth/login` — Body: `{ "usuario": "juana", "password": "..." }` → `{ token, mesera }`

### Pedidos

- `POST /api/pedidos` — crea un pedido (usado por la app Android). Requiere `Authorization: Bearer <token>`.
  Body: `{ "texto_pedido": "una arepa con queso y un cafe con leche" }`
- `GET /api/pedidos?estado=pendiente&fecha=2026-09-19` — lista pedidos (usado por la pantalla web). Filtros opcionales.
- `PATCH /api/pedidos/:id/listo` — marca un pedido como listo (usado por la pantalla de cocina).

### Tiempo real (Socket.io)

- Evento `pedido:nuevo` — se emite al crear un pedido, con el pedido completo.
- Evento `pedido:listo` — se emite al marcar un pedido listo, con `{ id }`.

## Variables de entorno

Ver `.env.example`.
