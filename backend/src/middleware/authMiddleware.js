const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token no provisto' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.mesera = { id: payload.id, nombre: payload.nombre, usuario: payload.usuario };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Clave de administrador invalida' });
  }
  next();
}

module.exports = { requireAuth, requireAdminKey };
