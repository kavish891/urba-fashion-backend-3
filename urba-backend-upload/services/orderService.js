const Product = require('../models/Product');
const ApiError = require('../utils/apiError');

/**
 * Server-side Order Calculation & Atomic Inventory Reservation Engine
 * NEVER TRUSTS PRICE, DISCOUNT, OR TOTAL SENT BY FRONTEND.
 */
class OrderService {
  /**
   * Validates client items against active products in MongoDB,
   * calculates line totals, discounts, and order subtotal completely server-side.
   */
  static async validateAndCalculateItems(requestedItems) {
    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      throw new ApiError(400, 'Order must contain at least one item');
    }

    const processedItems = [];
    let subtotal = 0;
    let totalDiscount = 0;

    for (const item of requestedItems) {
      const { productId, size, quantity } = item;

      if (!productId || !size || !quantity || quantity < 1) {
        throw new ApiError(400, 'Invalid item specification: productId, size, and quantity (> 0) are required');
      }

      const product = await Product.findOne({ _id: productId, isActive: true });

      if (!product) {
        throw new ApiError(404, `Product not available or out of stock: ${productId}`);
      }

      const sizeOption = (product.sizes || []).find(
        (s) => s.size.toUpperCase() === size.trim().toUpperCase()
      );

      if (!sizeOption) {
        throw new ApiError(400, `Selected size '${size}' is invalid for product '${product.name}'`);
      }

      if (sizeOption.stock < quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for '${product.name}' (Size: ${size}). Available: ${sizeOption.stock}, Requested: ${quantity}`
        );
      }

      // Compute pricing exclusively from verified DB values
      const unitOriginal = product.originalPrice;
      const discountPercentage = product.discount || 0;
      const unitFinal = product.finalPrice;
      const itemSubtotal = unitOriginal * quantity;
      const itemFinalTotal = Math.round(unitFinal * quantity * 100) / 100;
      const itemDiscountAmount = itemSubtotal - itemFinalTotal;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscountAmount;

      processedItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0]?.url || '',
        size: size.toUpperCase(),
        quantity,
        originalPrice: unitOriginal,
        discount: discountPercentage,
        unitPrice: unitFinal,
        totalPrice: itemFinalTotal,
      });
    }

    const total = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

    return {
      processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(totalDiscount * 100) / 100,
      total,
    };
  }

  /**
   * Atomically decrements product stock in MongoDB using findOneAndUpdate with $inc
   */
  static async reduceInventoryAtomically(processedItems) {
    for (const item of processedItems) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.product,
          isActive: true,
          'sizes.size': item.size,
          'sizes.stock': { $gte: item.quantity },
        },
        {
          $inc: {
            'sizes.$.stock': -item.quantity,
            totalStock: -item.quantity,
          },
        },
        { new: true }
      );

      if (!updated) {
        throw new ApiError(
          400,
          `Stock was depleted just now for ${item.name} (${item.size}). Please adjust your cart.`
        );
      }
    }
  }

  /**
   * Restores inventory if an order is cancelled or offline refund
   */
  static async restoreInventory(items) {
    for (const item of items) {
      const prodId = item.product || item.productId;
      if (prodId && item.size && item.quantity) {
        await Product.findOneAndUpdate(
          { _id: prodId, 'sizes.size': item.size },
          {
            $inc: {
              'sizes.$.stock': item.quantity,
              totalStock: item.quantity,
            },
          }
        );
      }
    }
  }
}

module.exports = OrderService;
