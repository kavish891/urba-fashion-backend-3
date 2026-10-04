const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const OrderService = require('../services/orderService');
const ApiError = require('../utils/apiError');

// Helper to generate unique human-readable order number: e.g. ORD-2026-98124
const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${new Date().getFullYear()}-${timestamp}${random}`;
};

// @desc    Customer: Place a new order with server-side pricing & inventory check
// @route   POST /api/orders
// @access  Public
exports.createOrder = async (req, res, next) => {
  try {
    const { customer, shippingAddress, items, paymentMethod = 'cod', notes } = req.body;

    if (!customer || !customer.name || !customer.email || !customer.phone) {
      throw new ApiError(400, 'Customer name, email, and phone number are required');
    }

    if (!shippingAddress || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      throw new ApiError(400, 'Complete shipping address (address, city, state, pincode) is required');
    }

    // Step 1: Validate items, sizes, stock, and calculate subtotal/discount/total completely server-side
    const { processedItems, subtotal, discount, total } = await OrderService.validateAndCalculateItems(items);

    // Free Product 777 Jackpot Voucher handling
    let finalDiscount = discount;
    let finalTotal = total;
    const isVoucherFree =
      paymentMethod === 'voucher_free' ||
      (notes && typeof notes === 'string' && notes.includes('777 JACKPOT FREE ITEM APPLIED'));

    if (isVoucherFree && processedItems.length > 0) {
      // Find highest priced item in cart to make 100% free
      const maxItemPrice = Math.max(...processedItems.map((it) => it.price || 0));
      finalDiscount = Math.min(subtotal, discount + maxItemPrice);
      finalTotal = Math.max(0, subtotal - finalDiscount);
    }

    // Step 2: Atomically deduct inventory to prevent race conditions
    await OrderService.reduceInventoryAtomically(processedItems);

    // Step 3: Create Order record in MongoDB
    const orderNumber = generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim(),
        userId: req.user ? req.user._id : null,
        channel: 'online',
      },
      shippingAddress: {
        address: shippingAddress.address.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        pincode: shippingAddress.pincode.trim(),
      },
      items: processedItems,
      subtotal,
      discount: finalDiscount,
      total: finalTotal,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: finalTotal === 0 ? 'paid' : 'pending',
      orderStatus: 'processing',
      notes: notes ? notes.trim() : '',
    });

    // Rule 2: When they buy items more than 777, grant a gambling slot machine spin
    let earnedSlotSpin = false;
    if (total > 777) {
      earnedSlotSpin = true;
      try {
        const userToCredit = req.user
          ? await User.findById(req.user._id)
          : await User.findOne({ email: customer.email.trim().toLowerCase() });

        if (userToCredit) {
          userToCredit.spinsAvailable = (userToCredit.spinsAvailable || 0) + 1;
          userToCredit.orderSpinsEarned = (userToCredit.orderSpinsEarned || 0) + 1;
          await userToCredit.save();
        }
      } catch (err) {
        console.error('Error crediting slot spin for order > 777:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order,
      earnedSlotSpin,
      slotSpinMessage: earnedSlotSpin
        ? '🎰 Order over ₹777 rewarded you with 1 Free Slot Machine Spin! Click LUCK to spin!'
        : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Lookup order by orderNumber + contact (email or phone)
// @route   GET /api/orders/lookup
// @access  Public
exports.lookupOrder = async (req, res, next) => {
  try {
    const { orderNumber, contact } = req.query;

    if (!orderNumber || !contact) {
      throw new ApiError(400, 'Order number and contact email/phone are required');
    }

    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanContact = contact.trim().toLowerCase();

    const order = await Order.findOne({
      orderNumber: cleanOrderNumber,
      $or: [
        { 'customer.email': cleanContact },
        { 'customer.phone': cleanContact },
      ],
    });

    if (!order) {
      throw new ApiError(404, 'No matching order found for provided details. Check your Order ID and contact information.');
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Get authenticated customer's own order history
// @route   GET /api/orders/my-orders
// @access  Authenticated Customer
exports.getMyOrders = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Please sign in to view your order history');
    }

    const orders = await Order.find({
      $or: [
        { 'customer.userId': req.user._id },
        { 'customer.email': req.user.email.toLowerCase() },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get list of orders with filters and pagination
// @route   GET /api/admin/orders
// @access  Admin
exports.getAdminOrders = async (req, res, next) => {
  try {
    const { status, channel, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.orderStatus = status.toLowerCase();
    if (channel) {
      if (channel === 'offline') {
        filter.$or = [
          { 'customer.channel': 'offline' },
          { orderNumber: /^OFF-/ },
          { paymentMethod: /^offline/ },
        ];
      } else if (channel === 'online') {
        filter.$and = [
          { 'customer.channel': { $ne: 'offline' } },
          { orderNumber: { $not: /^OFF-/ } },
        ];
      }
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { orderNumber: { $regex: q, $options: 'i' } },
        { 'customer.name': { $regex: q, $options: 'i' } },
        { 'customer.email': { $regex: q, $options: 'i' } },
        { 'customer.phone': { $regex: q, $options: 'i' } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create in-store / offline sale
// @route   POST /api/admin/orders/offline
// @access  Admin
exports.createOfflineOrder = async (req, res, next) => {
  try {
    const {
      productId,
      size,
      quantity = 1,
      customerName = 'Walk-in Customer',
      customerPhone = '',
      paymentMethod = 'offline_cash',
      notes = '',
    } = req.body;

    if (!productId || !size) {
      throw new ApiError(400, 'Product and size are required for offline sale');
    }

    const parsedQty = Math.max(1, parseInt(quantity, 10));
    const { processedItems, subtotal, discount, total } = await OrderService.validateAndCalculateItems([
      { productId, size, quantity: parsedQty },
    ]);

    await OrderService.reduceInventoryAtomically(processedItems);

    const offlineOrderNum = `OFF-${Date.now().toString().slice(-6)}`;
    const order = await Order.create({
      orderNumber: offlineOrderNum,
      customer: {
        name: customerName || 'Walk-in Customer',
        email: customerPhone ? `${customerPhone}@offline.store` : 'instore@urbanthreads.com',
        phone: customerPhone || 'In-Store',
        channel: 'offline',
      },
      shippingAddress: {
        address: 'In-Store Counter Pickup',
        city: 'Flagship Store',
        state: 'Delhi',
        pincode: '110001',
      },
      items: processedItems,
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      notes: `[Offline Sale] ${notes || ''}`.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Offline sale recorded and inventory updated',
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get single order by ID
// @route   GET /api/admin/orders/:id
// @access  Admin
exports.getAdminOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update order status
// @route   PATCH /api/admin/orders/:id/status
// @access  Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // If order is cancelled, return reserved stock
    if (orderStatus === 'cancelled' && order.orderStatus !== 'cancelled') {
      await OrderService.restoreInventory(order.items);
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get dashboard stats
// @route   GET /api/admin/dashboard/stats
// @access  Admin
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalOrders,
      orders,
      totalProducts,
      lowStockProducts,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.find({ orderStatus: { $ne: 'cancelled' } }),
      Product.countDocuments({ isActive: true }),
      Product.find({ isActive: true, totalStock: { $lte: 5 } }).select('name category totalStock sizes'),
    ]);

    let totalRevenue = 0;
    let onlineRevenue = 0;
    let offlineRevenue = 0;

    orders.forEach((o) => {
      const isOffline =
        (o.customer && o.customer.channel === 'offline') ||
        (o.orderNumber && o.orderNumber.startsWith('OFF-')) ||
        (o.paymentMethod && o.paymentMethod.startsWith('offline'));

      totalRevenue += Number(o.total || 0);
      if (isOffline) {
        offlineRevenue += Number(o.total || 0);
      } else {
        onlineRevenue += Number(o.total || 0);
      }
    });

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      success: true,
      stats: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        onlineRevenue: Math.round(onlineRevenue * 100) / 100,
        offlineRevenue: Math.round(offlineRevenue * 100) / 100,
        totalOrders,
        totalProducts,
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};
