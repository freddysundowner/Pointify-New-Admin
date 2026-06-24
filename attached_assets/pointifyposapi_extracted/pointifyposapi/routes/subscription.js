// subscriptionRoutes.js

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription');
router.post('/', subscriptionController.createSubscription);
router.post('/createCheckout', subscriptionController.stripeCheckout);
router.get('/stripesucess', subscriptionController.subscriptionSuccess);
router.get("/shop/sales", subscriptionController.getSubscriptionsByShopIds)
router.get('/', subscriptionController.getAllSubscriptions);
router.get("/shop/stats", subscriptionController.subscriptionStatistics)
router.get('/:id', subscriptionController.getSubscriptionById);
router.put('/', subscriptionController.assignShopsToSubscription);
router.delete('/:id', subscriptionController.deleteSubscription);
router.put("/stripe/updateAfterStripeSuccessPayment", subscriptionController.updateSubscriptionPayment)
router.put('/extend/:id', subscriptionController.extendSubscription);
router.get('/summary/stats', subscriptionController.summary);
router.post("/inapp/ios", subscriptionController.updateSubscriptionInappPayment)
router.post('/elimu/deposit', subscriptionController.depositElimu)
router.get("/licence/:id", subscriptionController.getlicence)
router.put("/verify/:id", subscriptionController.verifyTransaction)
module.exports = router;
 