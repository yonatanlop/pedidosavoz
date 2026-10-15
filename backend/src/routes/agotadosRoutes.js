const express = require('express');
const { marcarAgotado, listarAgotados } = require('../controllers/agotadosController');

function agotadosRouter(io) {
  const router = express.Router();

  // Usado por el Modo cocina de la app Android (sin auth, igual que marcarListo).
  router.post('/', marcarAgotado(io));

  // Consumido por la app de la mesera antes de enviar un pedido, y por el tablero web.
  router.get('/', listarAgotados);

  return router;
}

module.exports = agotadosRouter;
