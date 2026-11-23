-- Esquema inicial de PedidosVoz

CREATE TABLE IF NOT EXISTS meseras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  mesera_id INTEGER NOT NULL REFERENCES meseras(id),
  texto_pedido TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'listo')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_creacion TIME NOT NULL DEFAULT CURRENT_TIME,
  turno VARCHAR(20) NOT NULL DEFAULT 'desayuno' CHECK (turno IN ('desayuno', 'almuerzo')),
  numero_turno INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  listo_en TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_turno ON pedidos(fecha, turno);

-- Platos que cocina marca como agotados por voz ("se acabo la sopa"). Se
-- consideran vigentes solo para la fecha en que se registraron (se filtran
-- por fecha = CURRENT_DATE al consultar) — al dia siguiente dejan de aplicar.
CREATE TABLE IF NOT EXISTS agotados (
  id SERIAL PRIMARY KEY,
  nombre_plato TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agotados_fecha ON agotados(fecha);

-- Apartados y pedidos online -------------------------------------------------
-- Un pedido "apartado" no entra a la fila normal: va a la columna lateral del
-- tablero con su propio numero (numero_apartado, reinicia cada dia). Los
-- pedidos online se guardan con la mesera "Mesera_Online".
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS apartado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_apartado INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS hora_para TIME;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'mesera';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(100);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_celular VARCHAR(30);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ip_cliente VARCHAR(64);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS grupo_online VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_pedidos_apartado ON pedidos(apartado, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_ip_fecha ON pedidos(ip_cliente, fecha);

INSERT INTO meseras (nombre, usuario, password_hash)
VALUES ('Mesera_Online', 'mesera_online', '!sin-login')
ON CONFLICT (usuario) DO NOTHING;

-- Catalogo del menu armable (lo administra un administrador). "activo" = esta
-- en el menu de hoy. La imagen se guarda en la base de datos.
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  categoria VARCHAR(40) NOT NULL DEFAULT 'otro',
  imagen BYTEA,
  imagen_mime VARCHAR(50),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);
