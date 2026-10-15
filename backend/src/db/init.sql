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
