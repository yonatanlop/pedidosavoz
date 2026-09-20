const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const SALT_ROUNDS = 10;

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

module.exports = { register, login };
