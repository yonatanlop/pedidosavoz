const express = require('express');
const { requireAdminKey } = require('../middleware/authMiddleware');
const c = require('../controllers/menuController');

function menuRouter(io) {
  const router = express.Router();

  // Publico (pagina de almuerzos online)
  router.get('/', c.listarMenu);
  router.get('/items/:id/imagen', c.imagenItem);
  router.post('/pedido-online', c.crearPedidoOnline(io));

  // Administrador (header x-admin-key)
  router.post('/items', requireAdminKey, c.guardarItem(io));
  router.put('/items/:id', requireAdminKey, c.guardarItem(io));
  router.delete('/items/:id', requireAdminKey, c.borrarItem(io));
  router.post('/items/:id/agotado', requireAdminKey, c.marcarItemAgotado(io));

  return router;
}

module.exports = menuRouter;
