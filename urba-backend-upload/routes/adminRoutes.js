const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const analyticsController = require('../controllers/analyticsController');
const upload = require('../middleware/upload');

// Enforce authentication and admin role on ALL /api/admin routes
router.use(authenticate, authorize('admin'));

// Admin Dashboard Analytics & Performance
router.get('/dashboard/stats', orderController.getDashboardStats);
router.get('/analytics/overview', analyticsController.getAnalyticsOverview);

// Admin Product Management
router.get('/products', productController.getAdminProducts);
router.post('/products', upload.array('images', 5), productController.createProduct);
router.put('/products/:id', upload.array('images', 5), productController.updateProduct);
router.delete('/products/:id', productController.softDeleteProduct);
router.patch('/products/:id/toggle-status', productController.toggleProductStatus);

// Admin Order Management
router.get('/orders', orderController.getAdminOrders);
router.post('/orders/offline', orderController.createOfflineOrder);
router.get('/orders/:id', orderController.getAdminOrderById);
router.patch('/orders/:id/status', orderController.updateOrderStatus);

module.exports = router;
