const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const pedidosRouter = require('./routes/pedidosRoutes');

function createApp(io) {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/pedidos', pedidosRouter(io));

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  return app;
}

module.exports = createApp;
