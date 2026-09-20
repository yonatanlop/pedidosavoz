# PedidosVoz - Web

Pantalla de pedidos / cocina: HTML + CSS + JS plano (sin build step), servido por nginx.

nginx cumple dos roles:

1. Sirve los archivos estáticos (`public/`).
2. Actúa como reverse proxy hacia el backend para `/api/*` y `/socket.io/*` (ver `nginx.conf`), así el navegador solo habla con un origen y no hay que lidiar con CORS ni configurar URLs por entorno.

Dos paginas:

- **`index.html`** (tablero, `public/app.js`) — carga los pedidos pendientes al iniciar (`GET /api/pedidos?estado=pendiente`), se conecta por Socket.io y agrega/quita tarjetas en tiempo real (`pedido:nuevo`, `pedido:listo`), y al presionar "Listo" en una tarjeta llama `PATCH /api/pedidos/:id/listo`.
- **`historial.html`** (`public/historial.js`) — pedidos ya atendidos (`GET /api/pedidos?estado=listo&fecha=YYYY-MM-DD`) de un dia elegido con un selector de fecha (por defecto hoy). Se actualiza solo si estas viendo el dia de hoy y llega un `pedido:listo` nuevo.

Ambas paginas se enlazan entre si desde la barra superior.

## Correr en local

```bash
docker compose up --build web backend postgres
```

Abrir `http://localhost:8090` (tablero) y `http://localhost:8090/historial.html` (historial) — puerto configurado en el `docker-compose.yml` raíz.

## Desarrollo sin Docker

```bash
cd web
npm install   # solo para obtener el bundle de socket.io-client
```

Como es HTML/JS plano, para desarrollo rápido también se puede abrir `public/index.html` con un servidor estático que apunte el proxy de `/api` y `/socket.io` al backend (por ejemplo `vite` o `live-server` con proxy), o simplemente usar Docker como arriba.
