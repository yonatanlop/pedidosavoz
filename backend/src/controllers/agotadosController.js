const pool = require('../db/pool');

function serializeAgotado(row) {
  return {
    id: row.id,
    nombre_plato: row.nombre_plato,
    fecha: row.fecha,
    creado_en: row.creado_en,
  };
}

function marcarAgotado(io) {
  return async function (req, res) {
    const { nombre_plato } = req.body;

    if (!nombre_plato || !nombre_plato.trim()) {
      return res.status(400).json({ error: 'nombre_plato es requerido' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO agotados (nombre_plato)
         VALUES ($1)
         RETURNING id, nombre_plato, fecha, creado_en`,
        [nombre_plato.trim()]
      );

      const agotado = serializeAgotado(result.rows[0]);
      io.emit('agotado:nuevo', agotado);
      res.status(201).json(agotado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error registrando el plato agotado' });
    }
  };
}

async function listarAgotados(req, res) {
  // Sin "fecha" se usa CURRENT_DATE de la sesion de Postgres (zona horaria
  // local del restaurante, ver pool.js) en vez de la fecha de Node, para no
  // desfasarse de dia cerca de la medianoche.
  const { fecha } = req.query;

  try {
    const result = await pool.query(
      fecha
        ? `SELECT id, nombre_plato, fecha, creado_en FROM agotados WHERE fecha = $1 ORDER BY creado_en DESC`
        : `SELECT id, nombre_plato, fecha, creado_en FROM agotados WHERE fecha = CURRENT_DATE ORDER BY creado_en DESC`,
      fecha ? [fecha] : []
    );
    res.json(result.rows.map(serializeAgotado));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando platos agotados' });
  }
}

module.exports = { marcarAgotado, listarAgotados };
