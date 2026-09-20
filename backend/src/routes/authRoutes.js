const express = require('express');
const { register, login, autoregistro } = require('../controllers/authController');
const { requireAdminKey } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', requireAdminKey, register);
router.post('/login', login);

// Usado por la app Android: la mesera solo escribe su nombre, sin password.
router.post('/registro', autoregistro);

module.exports = router;
