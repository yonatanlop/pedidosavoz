require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

async function seed() {
  const nombre = process.env.SEED_NOMBRE || 'Mesera Demo';
  const usuario = process.env.SEED_USUARIO || 'demo';
  const password = process.env.SEED_PASSWORD || 'demo1234';

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      `INSERT INTO meseras (nombre, usuario, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario) DO NOTHING`,
      [nombre, usuario, passwordHash]
    );
    console.log(`Mesera de prueba lista -> usuario: ${usuario} / password: ${password}`);
  } catch (err) {
    console.error('Error creando mesera de prueba:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
