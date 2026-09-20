const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');

const SALT_ROUNDS = 10;

// Token largo porque el autoregistro no tiene password: la mesera "inicia
// sesion" una sola vez al instalar la app y el token queda guardado en el
// dispositivo hasta que alguien presione "Salir".
const EXPIRES_IN_AUTOREGISTRO = '180d';

function firmarToken(mesera) {
  return jwt.sign(
    { id: mesera.id, nombre: mesera.nombre, usuario: mesera.usuario },
    process.env.JWT_SECRET,
    { expiresIn: EXPIRES_IN_AUTOREGISTRO }
  );
}

function slugify(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return base.slice(0, 20) || 'mesera';
}

async function register(req, res) {
  const { nombre, usuario, password } = req.body;

  if (!nombre || !usuario || !password) {
    return res.status(400).json({ error: 'nombre, usuario y password son requeridos' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO meseras (nombre, usuario, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, usuario, creado_en`,
      [nombre, usuario, passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error creando la mesera' });
  }
}

async function login(req, res) {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'usuario y password son requeridos' });
  }

  try {
    const result = await pool.query('SELECT * FROM meseras WHERE usuario = $1', [usuario]);
    const mesera = result.rows[0];

    if (!mesera) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const validPassword = await bcrypt.compare(password, mesera.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { id: mesera.id, nombre: mesera.nombre, usuario: mesera.usuario },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      mesera: { id: mesera.id, nombre: mesera.nombre, usuario: mesera.usuario },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error iniciando sesion' });
  }
}

async function autoregistro(req, res) {
  const { nombre } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'nombre es requerido' });
  }

  const nombreLimpio = nombre.trim();
  const base = slugify(nombreLimpio);
  const passwordAleatoria = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(passwordAleatoria, SALT_ROUNDS);

  for (let intento = 0; intento < 5; intento++) {
    const usuario = intento === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const result = await pool.query(
        `INSERT INTO meseras (nombre, usuario, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, nombre, usuario`,
        [nombreLimpio, usuario, passwordHash]
      );
      const mesera = result.rows[0];
      return res.status(201).json({ token: firmarToken(mesera), mesera });
    } catch (err) {
      if (err.code === '23505') continue; // usuario duplicado, reintentar con sufijo
      console.error(err);
      return res.status(500).json({ error: 'Error registrando la mesera' });
    }
  }

  res.status(500).json({ error: 'No se pudo generar un usuario unico, intenta de nuevo' });
}

module.exports = { register, login, autoregistro };
