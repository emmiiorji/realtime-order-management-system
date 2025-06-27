const express = require('express');
const paymentController = require('../controllers/paymentController');
const { 
  validatePaymentIntent, 
  validatePaymentConfirmation,
  validateRefund,
  validateObjectId 
} = require('../middleware/validation');

const router = express.Router();

// Payment intent routes
router.post('/create-intent', validatePaymentIntent, paymentController.createPaymentIntent);
router.post('/confirm', validatePaymentConfirmation, paymentController.confirmPayment);

// Payment method routes
router.get('/payment-methods/:customerId', validateObjectId, paymentController.getPaymentMethods);
router.post('/save-payment-method', paymentController.savePaymentMethod);

// Refund routes
router.post('/refund', validateRefund, paymentController.processRefund);

// Payment history
router.get('/history/:customerId', validateObjectId, paymentController.getPaymentHistory);

// Webhook endpoint (should be before any middleware that parses JSON)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router;
