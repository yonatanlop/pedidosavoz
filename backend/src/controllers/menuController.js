const crypto = require('crypto');
const pool = require('../db/pool');
const { insertarPedido } = require('./pedidosController');

const MAX_ALMUERZOS_POR_IP_DIA = Number(process.env.MAX_ONLINE_POR_IP || 3);
const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'un', 'una']);

class ErrorUsuario extends Error {}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabras(texto) {
  return normalizar(texto).split(' ').filter((p) => p.length > 1 && !STOPWORDS.has(p));
}

// Un item esta agotado si algun plato agotado hoy comparte >= 60% de las
// palabras de la lista mas corta ("cerdo" agota "Carne de cerdo").
function estaAgotado(nombreItem, nombresAgotados) {
  const a = palabras(nombreItem);
  if (!a.length) return false;
  return nombresAgotados.some((nombre) => {
    const b = palabras(nombre);
    if (!b.length) return false;
    const comunes = a.filter((p) => b.includes(p)).length;
    return comunes / Math.min(a.length, b.length) >= 0.6;
  });
}

async function agotadosDeHoy(db = pool) {
  const r = await db.query('SELECT id, nombre_plato FROM agotados WHERE fecha = CURRENT_DATE');
  return r.rows;
}

const SELECT_ITEMS = `
  SELECT id, nombre, categoria, activo, orden, (imagen IS NOT NULL) AS tiene_imagen,
         COALESCE(length(imagen), 0) AS version
  FROM menu_items`;

function serializeItem(row, agotados) {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    activo: row.activo,
    orden: row.orden,
    agotado: estaAgotado(row.nombre, agotados.map((x) => x.nombre_plato)),
    imagen_url: row.tiene_imagen ? `/api/menu/items/${row.id}/imagen?v=${row.version}` : null,
  };
}

// Publico: solo lo que esta en el menu de hoy. Con x-admin-key y ?todos=1
// trae todo el catalogo (pagina del administrador).
async function listarMenu(req, res) {
  try {
    const todos = req.query.todos === '1' && req.headers['x-admin-key'] === process.env.ADMIN_KEY;
    const [items, agotados] = await Promise.all([
      pool.query(`${SELECT_ITEMS} ${todos ? '' : 'WHERE activo = TRUE'} ORDER BY orden, id`),
      agotadosDeHoy(),
    ]);
    res.json(items.rows.map((r) => serializeItem(r, agotados)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando el menu' });
  }
}

async function imagenItem(req, res) {
  try {
    const r = await pool.query('SELECT imagen, imagen_mime FROM menu_items WHERE id = $1', [req.params.id]);
    if (!r.rowCount || !r.rows[0].imagen) return res.status(404).end();
    res.set('Content-Type', r.rows[0].imagen_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(r.rows[0].imagen);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
}

function leerImagen(body) {
  if (!body.imagen_base64) return null;
  const mime = String(body.imagen_mime || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new ErrorUsuario('Formato de imagen no permitido (usa JPG, PNG o WEBP)');
  const buffer = Buffer.from(String(body.imagen_base64).replace(/^data:[^,]*,/, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGEN_BYTES) throw new ErrorUsuario('La imagen esta vacia o pesa mas de 2 MB');
  return { buffer, mime };
}

function guardarItem(io) {
  return async function (req, res) {
    const id = req.params.id ? Number(req.params.id) : null;
    const b = req.body || {};
    try {
      const nombre = b.nombre !== undefined ? String(b.nombre).trim() : undefined;
      if (!id && !nombre) return res.status(400).json({ error: 'nombre es requerido' });
      const imagen = leerImagen(b);

      let r;
      if (!id) {
        r = await pool.query(
          `INSERT INTO menu_items (nombre, categoria, imagen, imagen_mime, activo, orden)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [nombre, String(b.categoria || 'otro').trim().toLowerCase(), imagen ? imagen.buffer : null,
           imagen ? imagen.mime : null, b.activo !== false, Number(b.orden) || 0]
        );
      } else {
        r = await pool.query(
          `UPDATE menu_items SET
             nombre = COALESCE($2, nombre),
             categoria = COALESCE($3, categoria),
             activo = COALESCE($4, activo),
             orden = COALESCE($5, orden),
             imagen = COALESCE($6, imagen),
             imagen_mime = COALESCE($7, imagen_mime)
           WHERE id = $1 RETURNING id`,
          [id, nombre || null, b.categoria ? String(b.categoria).trim().toLowerCase() : null,
           typeof b.activo === 'boolean' ? b.activo : null,
           b.orden !== undefined ? Number(b.orden) : null,
           imagen ? imagen.buffer : null, imagen ? imagen.mime : null]
        );
        if (!r.rowCount) return res.status(404).json({ error: 'Item no encontrado' });
      }
      io.emit('menu:actualizado');
      const item = await pool.query(`${SELECT_ITEMS} WHERE id = $1`, [r.rows[0].id]);
      res.status(id ? 200 : 201).json(serializeItem(item.rows[0], await agotadosDeHoy()));
    } catch (err) {
      if (err instanceof ErrorUsuario) return res.status(400).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Error guardando el item' });
    }
  };
}

function borrarItem(io) {
  return async function (req, res) {
    try {
      const r = await pool.query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
      if (!r.rowCount) return res.status(404).json({ error: 'Item no encontrado' });
      io.emit('menu:actualizado');
      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error borrando el item' });
    }
  };
}

// El administrador marca/desmarca un item como agotado por hoy (igual que
// cuando cocina lo dice por voz).
function marcarItemAgotado(io) {
  return async function (req, res) {
    try {
      const item = await pool.query('SELECT nombre FROM menu_items WHERE id = $1', [req.params.id]);
      if (!item.rowCount) return res.status(404).json({ error: 'Item no encontrado' });
      const nombre = item.rows[0].nombre;
      const agotado = req.body.agotado !== false;
      const hoy = await agotadosDeHoy();

      if (agotado) {
        if (!estaAgotado(nombre, hoy.map((x) => x.nombre_plato))) {
          const ins = await pool.query(
            'INSERT INTO agotados (nombre_plato) VALUES ($1) RETURNING id, nombre_plato, fecha, creado_en', [nombre]);
          io.emit('agotado:nuevo', ins.rows[0]);
        }
      } else {
        const ids = hoy.filter((a) => estaAgotado(nombre, [a.nombre_plato])).map((a) => a.id);
        if (ids.length) await pool.query('DELETE FROM agotados WHERE id = ANY($1::int[])', [ids]);
      }
      io.emit('menu:actualizado');
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error actualizando el agotado' });
    }
  };
}

function validarHora(h) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(h || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

// Publico: el cliente arma uno o varios almuerzos; cada uno queda como un
// apartado con su propio identificador (numero_apartado).
function crearPedidoOnline(io) {
  return async function (req, res) {
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    const celular = String(b.celular || '').replace(/[^\d+]/g, '');
    const hora = validarHora(b.hora_para);
    const almuerzos = Array.isArray(b.almuerzos) ? b.almuerzos : [];

    if (nombre.length < 2 || nombre.length > 100) return res.status(400).json({ error: 'Escribe tu nombre' });
    if (celular.replace(/\D/g, '').length < 7 || celular.length > 20) {
      return res.status(400).json({ error: 'Escribe un numero de celular valido' });
    }
    if (!hora) return res.status(400).json({ error: 'Indica la hora para la que lo necesitas (HH:MM)' });
    if (!almuerzos.length) return res.status(400).json({ error: 'Agrega al menos un almuerzo' });

    const ip = req.ip || 'desconocida';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Bloquea por IP para que dos envios simultaneos no se salten el limite.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`online:${ip}`]);

      const usados = await client.query(
        `SELECT COUNT(*)::int AS n FROM pedidos
         WHERE origen = 'online' AND ip_cliente = $1 AND fecha = CURRENT_DATE`,
        [ip]
      );
      if (usados.rows[0].n + almuerzos.length > MAX_ALMUERZOS_POR_IP_DIA) {
        await client.query('ROLLBACK');
        const quedan = Math.max(0, MAX_ALMUERZOS_POR_IP_DIA - usados.rows[0].n);
        return res.status(429).json({
          error: `Maximo ${MAX_ALMUERZOS_POR_IP_DIA} almuerzos por dispositivo al dia. Te quedan ${quedan}.`,
        });
      }

      const [catalogo, agotados] = await Promise.all([
        client.query('SELECT id, nombre FROM menu_items WHERE activo = TRUE'),
        agotadosDeHoy(client),
      ]);
      const porId = new Map(catalogo.rows.map((r) => [r.id, r.nombre]));
      const nombresAgotados = agotados.map((a) => a.nombre_plato);

      const textos = [];
      for (const almuerzo of almuerzos) {
        const ids = [...new Set((Array.isArray(almuerzo.items) ? almuerzo.items : []).map(Number))];
        if (!ids.length) throw new ErrorUsuario('Cada almuerzo necesita al menos un item');
        const nombres = ids.map((itemId) => {
          const n = porId.get(itemId);
          if (!n) throw new ErrorUsuario('Un item del menu ya no esta disponible, recarga la pagina');
          if (estaAgotado(n, nombresAgotados)) throw new ErrorUsuario(`Se agoto: ${n}. Quitalo e intenta de nuevo`);
          return n;
        });
        textos.push(nombres.join(', '));
      }

      const meseraOnline = await client.query(`SELECT id FROM meseras WHERE usuario = 'mesera_online'`);
      if (!meseraOnline.rowCount) throw new Error('Falta la mesera Mesera_Online (aplica migrate.sql)');

      const grupo = crypto.randomUUID();
      const creados = [];
      for (const texto of textos) {
        creados.push(await insertarPedido(client, {
          meseraId: meseraOnline.rows[0].id,
          texto,
          apartado: true,
          horaPara: hora,
          origen: 'online',
          clienteNombre: nombre,
          clienteCelular: celular,
          ip,
          grupoOnline: grupo,
        }));
      }
      await client.query('COMMIT');

      creados.forEach((p) => io.emit('pedido:nuevo', p));
      res.status(201).json({
        hora_para: hora,
        apartados: creados.map((p) => ({ id: p.id, numero_apartado: p.numero_apartado, texto_pedido: p.texto_pedido })),
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof ErrorUsuario) return res.status(400).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'No se pudo registrar el pedido' });
    } finally {
      client.release();
    }
  };
}

module.exports = { listarMenu, imagenItem, guardarItem, borrarItem, marcarItemAgotado, crearPedidoOnline };
