# PedidosVoz

Sistema de pedidos de desayuno/almuerzo dictados por voz. Una mesera dicta el pedido desde una app Android (compatible con manos libres), el pedido aparece en tiempo real en una pantalla web para cocina, y cocina lo marca como listo cuando está terminado.

## Componentes

- **`backend/`** — API Node.js/Express + Socket.io + PostgreSQL. Guarda cada pedido con fecha, hora, texto completo y la mesera que lo hizo. ([docs](backend/README.md))
- **`web/`** — Pantalla de pedidos en tiempo real para cocina. *(pendiente)*
- **`android/`** — App para que las meseras dicten el pedido por voz. *(pendiente)*
- **`docker-compose.yml`** — Orquesta todo para correr localmente o desplegar en una VM de Oracle Cloud (OCI).

## Estado del proyecto

1. ✅ Backend + base de datos + docker-compose
2. ⬜ Web app del tablero de pedidos
3. ⬜ App Android (login + dictado por voz)
4. ⬜ Integración end-to-end
5. ⬜ Despliegue en Oracle Cloud (OCI)

## Levantar el backend en local

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Ver [backend/README.md](backend/README.md) para el detalle de la API.
