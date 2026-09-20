# PedidosVoz

Sistema de pedidos de desayuno/almuerzo dictados por voz. Una mesera dicta el pedido desde una app Android (compatible con manos libres), el pedido aparece en tiempo real en una pantalla web para cocina, y cocina lo marca como listo cuando está terminado.

## Componentes

- **`backend/`** — API Node.js/Express + Socket.io + PostgreSQL. Guarda cada pedido con fecha, hora, texto completo y la mesera que lo hizo. ([docs](backend/README.md))
- **`web/`** — Pantalla de pedidos en tiempo real para cocina (HTML/JS + nginx como proxy). ([docs](web/README.md))
- **`android/`** — App Kotlin/Compose para que las meseras dicten el pedido por voz (con soporte de manos libres Bluetooth). ([docs](android/README.md))
- **`docker-compose.yml`** — Orquesta todo para correr localmente o desplegar en una VM de Oracle Cloud (OCI).

## Estado del proyecto

1. ✅ Backend + base de datos + docker-compose
2. ✅ Web app del tablero de pedidos
3. ✅ App Android (login + dictado por voz) — compilada y probada parcialmente, ver [android/README.md](android/README.md#estado-de-las-pruebas)
4. ⬜ Integración end-to-end en un dispositivo real
5. 🔄 Despliegue en Oracle Cloud (OCI) — ver [deploy/shared-caddy.md](deploy/shared-caddy.md)

## Levantar todo en local

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build
```

- Backend: `http://localhost:3000`
- Tablero web: `http://localhost:8090`

Crear una mesera de prueba:

```bash
docker compose exec backend npm run seed
```

Ver [backend/README.md](backend/README.md) y [web/README.md](web/README.md) para el detalle de cada componente.
