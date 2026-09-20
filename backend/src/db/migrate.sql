-- Migraciones idempotentes: seguras de correr varias veces sobre una base de
-- datos que ya existe (init.sql solo aplica en un volumen nuevo).
--
--   docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -f - < backend/src/db/migrate.sql

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS turno VARCHAR(20) NOT NULL DEFAULT 'desayuno';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_turno INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_turno_check'
  ) THEN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_turno_check CHECK (turno IN ('desayuno', 'almuerzo'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_turno ON pedidos(fecha, turno);
