// routes/permissions.js
const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissions');
const auth = require('../middleware/auth');

router.get('/', auth, permissionController.getAll);
router.post('/', auth, permissionController.create);
router.delete('/:id', auth, permissionController.delete);

module.exports = router;