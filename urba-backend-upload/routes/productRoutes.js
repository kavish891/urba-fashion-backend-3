const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Public customer routes
router.get('/', productController.getProducts);
router.get('/:slugOrId', productController.getProductBySlugOrId);

module.exports = router;
