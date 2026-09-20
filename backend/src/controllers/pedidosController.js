const pool = require('../db/pool');

const SELECT_PEDIDO_CON_MESERA = `
  SELECT p.id, p.texto_pedido, p.estado, p.fecha, p.hora_creacion, p.creado_en, p.listo_en,
         m.id AS mesera_id, m.nombre AS mesera_nombre
  FROM pedidos p
  JOIN meseras m ON m.id = p.mesera_id
`;

function serializePedido(row) {
  return {
    id: row.id,
    texto_pedido: row.texto_pedido,
    estado: row.estado,
    fecha: row.fecha,
    hora_creacion: row.hora_creacion,
    creado_en: row.creado_en,
    listo_en: row.listo_en,
    mesera: { id: row.mesera_id, nombre: row.mesera_nombre },
  };
}

function crearPedido(io) {
  return async function (req, res) {
    const { texto_pedido } = req.body;

    if (!texto_pedido || !texto_pedido.trim()) {
      return res.status(400).json({ error: 'texto_pedido es requerido' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO pedidos (mesera_id, texto_pedido)
         VALUES ($1, $2)
         RETURNING id`,
        [req.mesera.id, texto_pedido.trim()]
      );

      const pedidoId = result.rows[0].id;
      const pedidoResult = await pool.query(`${SELECT_PEDIDO_CON_MESERA} WHERE p.id = $1`, [pedidoId]);
      const pedido = serializePedido(pedidoResult.rows[0]);

      io.emit('pedido:nuevo', pedido);
      res.status(201).json(pedido);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error creando el pedido' });
    }
  };
}

async function listarPedidos(req, res) {
  const { estado, fecha } = req.query;
  const condiciones = [];
  const valores = [];

  if (estado) {
    valores.push(estado);
    condiciones.push(`p.estado = $${valores.length}`);
  }
  if (fecha) {
    valores.push(fecha);
    condiciones.push(`p.fecha = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `${SELECT_PEDIDO_CON_MESERA} ${where} ORDER BY p.creado_en ASC`,
      valores
    );
    res.json(result.rows.map(serializePedido));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando pedidos' });
  }
}

function marcarListo(io) {
  return async function (req, res) {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `UPDATE pedidos SET estado = 'listo', listo_en = NOW()
         WHERE id = $1 AND estado = 'pendiente'
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado o ya estaba listo' });
      }

      const pedidoResult = await pool.query(`${SELECT_PEDIDO_CON_MESERA} WHERE p.id = $1`, [id]);
      const pedido = serializePedido(pedidoResult.rows[0]);

      io.emit('pedido:listo', { id: pedido.id });
      res.json(pedido);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error marcando el pedido como listo' });
    }
  };
}

module.exports = { crearPedido, listarPedidos, marcarListo };
