const express = require('express');
const { register, login } = require('../controllers/authController');
const { requireAdminKey } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', requireAdminKey, register);
router.post('/login', login);

module.exports = router;
