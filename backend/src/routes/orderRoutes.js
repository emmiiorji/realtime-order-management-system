const express = require('express');
const orderController = require('../controllers/orderController');
const { 
  validateOrder, 
  validateOrderUpdate, 
  validatePagination,
  validateObjectId 
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.get('/stats', orderController.getOrderStats);

// Protected routes (require authentication)
// router.use(authController.protect); // We'll implement this later

// User order routes
router.get('/my-orders', validatePagination, orderController.getMyOrders);
router.post('/', validateOrder, orderController.createOrder);
router.get('/:id', validateObjectId, orderController.getOrder);
router.patch('/:id', validateObjectId, validateOrderUpdate, orderController.updateOrder);
router.delete('/:id', validateObjectId, orderController.cancelOrder);

// Order tracking
router.get('/:id/tracking', validateObjectId, orderController.getOrderTracking);

// Admin routes
// router.use(authController.restrictTo('admin')); // We'll implement this later

router.get('/', validatePagination, orderController.getAllOrders);
router.patch('/:id/status', validateObjectId, orderController.updateOrderStatus);

module.exports = router;
