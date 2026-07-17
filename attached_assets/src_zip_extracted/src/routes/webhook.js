const webhookController = require("../controllers/webhookController");
const express = require("express");
const webhookRouter = express.Router();
webhookRouter.post(
  "/paystack",
  express.raw({ type: "application/json" }),
  webhookController.handlePaystackWebhook
);
  

module.exports = webhookRouter;
