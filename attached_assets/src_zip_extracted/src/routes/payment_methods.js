const express = require('express');
const router = express.Router();

const paymentMethodController = require('../controllers/payment_methods');
router.post('/', paymentMethodController.addPaymentMethod);
router.get('/', paymentMethodController.getAllPaymentMethods);
router.get('/:id', paymentMethodController.getPaymentMethodById);
router.put('/:id', paymentMethodController.updatePaymentMethod);
router.delete('/:id', paymentMethodController.deletePaymentMethod);

module.exports = router;