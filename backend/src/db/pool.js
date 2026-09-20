const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Por defecto Postgres guarda fechas/horas en UTC. Se fija la zona horaria de
// cada sesion para que CURRENT_DATE/CURRENT_TIME/NOW() reflejen la hora local
// del restaurante (necesario para el corte desayuno/almuerzo y para que las
// horas mostradas en el tablero tengan sentido).
pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${process.env.TZ || 'America/Bogota'}'`);
});

module.exports = pool;
