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
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  listo_en TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
