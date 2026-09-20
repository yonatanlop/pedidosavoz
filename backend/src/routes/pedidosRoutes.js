const express = require('express');
const { crearPedido, listarPedidos, marcarListo } = require('../controllers/pedidosController');
const { requireAuth } = require('../middleware/authMiddleware');

function pedidosRouter(io) {
  const router = express.Router();

  // Creado desde la app Android (requiere sesion de mesera)
  router.post('/', requireAuth, crearPedido(io));

  // Consumido por la pantalla web de pedidos/cocina
  router.get('/', listarPedidos);
  router.patch('/:id/listo', marcarListo(io));

  return router;
}

module.exports = pedidosRouter;
