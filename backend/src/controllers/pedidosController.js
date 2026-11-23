const pool = require('../db/pool');

// listo_en se formatea con to_char (texto plano en la zona horaria de la
// sesion) en vez de dejar que node-postgres lo convierta a un objeto Date:
// un TIMESTAMP sin zona horaria se reinterpreta con la zona horaria del
// propio proceso de Node al construir ese Date, lo que puede desfasar la
// hora mostrada si esa zona no coincide con la de la sesion de Postgres.
const SELECT_PEDIDO_CON_MESERA = `
  SELECT p.id, p.texto_pedido, p.estado, p.fecha, p.hora_creacion, p.turno, p.numero_turno,
         p.creado_en, to_char(p.listo_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS listo_en,
         p.apartado, p.numero_apartado, to_char(p.hora_para, 'HH24:MI') AS hora_para, p.origen,
         p.cliente_nombre, p.cliente_celular,
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
    turno: row.turno,
    numero_turno: row.numero_turno,
    creado_en: row.creado_en,
    listo_en: row.listo_en,
    apartado: row.apartado,
    numero_apartado: row.numero_apartado,
    hora_para: row.hora_para,
    origen: row.origen,
    cliente_nombre: row.cliente_nombre,
    cliente_celular: row.cliente_celular,
    mesera: { id: row.mesera_id, nombre: row.mesera_nombre },
  };
}

// Si la mesera empieza el dictado con "apartado ..." (o "apartar ...") el
// pedido va a la columna de apartados. Se quita esa palabra (y "de"/"para")
// del texto guardado.
const REGEX_APARTADO = /^\s*apart(?:ado|ar|a)\b[\s:,.\-]*(?:de\b|del\b|para\b)?\s*/i;

function detectarApartado(texto) {
  const match = REGEX_APARTADO.exec(texto);
  if (!match) return { apartado: false, texto: texto.trim() };
  return { apartado: true, texto: texto.slice(match[0].length).trim() };
}

// Inserta un pedido normal o apartado. "db" puede ser el pool o un client de
// una transaccion. Los apartados no consumen numero_turno (queda en 0) para no
// dejar huecos en la numeracion de la fila normal.
async function insertarPedido(db, { meseraId, texto, apartado, horaPara, origen, clienteNombre, clienteCelular, ip, grupoOnline }) {
  const corteAlmuerzo = process.env.TURNO_ALMUERZO_DESDE || '11:00';
  const turnoSql = `CASE WHEN CURRENT_TIME >= $3::time THEN 'almuerzo' ELSE 'desayuno' END`;

  const result = await db.query(
    `INSERT INTO pedidos (mesera_id, texto_pedido, turno, numero_turno, apartado, numero_apartado,
                          hora_para, origen, cliente_nombre, cliente_celular, ip_cliente, grupo_online)
     VALUES (
       $1, $2,
       ${turnoSql},
       CASE WHEN $4::boolean THEN 0 ELSE (
         SELECT COALESCE(MAX(numero_turno), 0) + 1 FROM pedidos
         WHERE fecha = CURRENT_DATE AND apartado = FALSE AND turno = ${turnoSql}
       ) END,
       $4::boolean,
       CASE WHEN $4::boolean THEN (
         SELECT COALESCE(MAX(numero_apartado), 0) + 1 FROM pedidos
         WHERE fecha = CURRENT_DATE AND apartado = TRUE
       ) ELSE NULL END,
       $5::time, $6, $7, $8, $9, $10
     )
     RETURNING id`,
    [meseraId, texto, corteAlmuerzo, apartado, horaPara || null, origen || 'mesera',
     clienteNombre || null, clienteCelular || null, ip || null, grupoOnline || null]
  );

  const pedidoResult = await db.query(`${SELECT_PEDIDO_CON_MESERA} WHERE p.id = $1`, [result.rows[0].id]);
  return serializePedido(pedidoResult.rows[0]);
}

function crearPedido(io) {
  return async function (req, res) {
    const bruto = typeof req.body.texto_pedido === 'string' ? req.body.texto_pedido : '';

    if (!bruto.trim()) {
      return res.status(400).json({ error: 'texto_pedido es requerido' });
    }

    const detectado = detectarApartado(bruto);
    const apartado = detectado.apartado || req.body.apartado === true;
    const texto = detectado.texto;

    if (!texto) {
      return res.status(400).json({ error: 'Dime que se va a apartar, por ejemplo "apartado de arroz y pollo"' });
    }

    try {
      const pedido = await insertarPedido(pool, {
        meseraId: req.mesera.id,
        texto,
        apartado,
        horaPara: req.body.hora_para,
        origen: 'mesera',
      });

      io.emit('pedido:nuevo', pedido);
      res.status(201).json(pedido);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error creando el pedido' });
    }
  };
}

async function listarPedidos(req, res) {
  const { estado, fecha, apartado } = req.query;
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

  if (apartado === 'true' || apartado === 'false') {
    valores.push(apartado === 'true');
    condiciones.push(`p.apartado = $${valores.length}`);
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

module.exports = {
  crearPedido,
  listarPedidos,
  marcarListo,
  insertarPedido,
  serializePedido,
  SELECT_PEDIDO_CON_MESERA,
};
