# PedidosVoz - Web

Pantalla de pedidos / cocina: HTML + CSS + JS plano (sin build step), servido por nginx.

nginx cumple dos roles:

1. Sirve los archivos estáticos (`public/`).
2. Actúa como reverse proxy hacia el backend para `/api/*` y `/socket.io/*` (ver `nginx.conf`), así el navegador solo habla con un origen y no hay que lidiar con CORS ni configurar URLs por entorno.

El frontend (`public/app.js`):
- Carga los pedidos pendientes al iniciar (`GET /api/pedidos?estado=pendiente`).
- Se conecta por Socket.io y agrega/quita tarjetas en tiempo real (`pedido:nuevo`, `pedido:listo`).
- Al presionar "Listo" en una tarjeta, llama `PATCH /api/pedidos/:id/listo`.

## Correr en local

```bash
docker compose up --build web backend postgres
```

Abrir `http://localhost:8090` (puerto configurado en el `docker-compose.yml` raíz).

## Desarrollo sin Docker

```bash
cd web
npm install   # solo para obtener el bundle de socket.io-client
```

Como es HTML/JS plano, para desarrollo rápido también se puede abrir `public/index.html` con un servidor estático que apunte el proxy de `/api` y `/socket.io` al backend (por ejemplo `vite` o `live-server` con proxy), o simplemente usar Docker como arriba.
