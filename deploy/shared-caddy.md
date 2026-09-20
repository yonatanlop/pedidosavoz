# Integración con el Caddy compartido de otros proyectos

**Estado actual (2026-09-20)**: desplegado y verificado en
`149.118.61.207` (Ubuntu 20.04 aarch64), corriendo en
`/home/ubuntu/pedidosavoz`. Login, creación de pedido y marcar-listo
probados de punta a punta contra `https://pedidoavoz.duckdns.org/`.
`detectoria` fue removido del servidor; solo conviven `gamificacion-fundacion`
y `pedidosavoz`.

Este servidor ya corría otro proyecto (`gamificacion-fundacion`) cuyo
contenedor `caddy` es el único proceso escuchando en los puertos 80/443 de la
IP pública. Solo un proceso puede escuchar en esos puertos, así que
PedidosVoz no puede traer su propio Caddy — tiene que sumarse al que ya
existe (mismo patrón usado antes para integrar `detectoria`, que ya no está).

**Decisión explícita**: no se modifica el repositorio ni el `docker-compose`
de `gamificacion-fundacion`. En su lugar, `deploy/patch-shared-caddy.sh` hace
dos cosas en caliente sobre el contenedor `caddy` que ya está corriendo:

1. Lo conecta a la red Docker compartida `edge` (ya existe, creada para
   `detectoria`), sin desconectarlo de la suya propia — los sitios existentes
   siguen funcionando exactamente igual.
2. Le agrega un bloque de sitio más al Caddyfile en ejecución (`docker exec`
   + `caddy reload`, sin reiniciar el contenedor, sin downtime) que enruta
   `pedidoavoz.duckdns.org` hacia `pedidosavoz-web:80` en esa red.

## Importante: esto no es persistente

El `docker-compose.prod.yml` de `gamificacion-fundacion` regenera el
Caddyfile desde cero (solo con su propio dominio) cada vez que ese contenedor
arranca. Como no tocamos ese archivo, **si el contenedor `caddy` de ese otro
proyecto se recrea** (un redeploy de `gamificacion-fundacion`, un reinicio de
la VM, etc.), el bloque de PedidosVoz se pierde y hay que volver a correr:

```bash
./deploy/patch-shared-caddy.sh
```

Es idempotente — se puede correr las veces que haga falta sin duplicar nada
ni afectar el sitio de los otros proyectos.

## Orden de despliegue en la VM

```bash
git clone https://github.com/yonatanlop/pedidosavoz.git
cd pedidosavoz
cp .env.example .env                  # credenciales de Postgres
cp backend/.env.example backend/.env  # JWT_SECRET, ADMIN_KEY, etc.
# editar ambos .env con valores reales (no dejar "changeme")

docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --build

./deploy/patch-shared-caddy.sh
```

Verificar: `https://pedidoavoz.duckdns.org/` y que
`https://gamificaciones.duckdns.org/` siga funcionando igual que antes.
