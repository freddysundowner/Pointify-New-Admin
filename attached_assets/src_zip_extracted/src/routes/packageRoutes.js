// packageRoutes.js

const express = require('express');
const router = express.Router();
const packageController = require('../controllers/package');
router.post('/', packageController.createPackage);
router.get('/', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);
router.put('/:id', packageController.updatePackage);
router.delete('/:id', packageController.deletePackage);

module.exports = router;
