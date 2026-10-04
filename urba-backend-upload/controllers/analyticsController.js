const Analytics = require('../models/Analytics');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/apiError');

// @desc    Track a customer event (product_view, add_to_cart, search, etc.)
// @route   POST /api/analytics/track
// @access  Public
exports.trackEvent = async (req, res, next) => {
  try {
    const { eventType, productId, metadata = {}, sessionId } = req.body;

    const validEvents = [
      'page_view',
      'product_view',
      'add_to_cart',
      'remove_from_cart',
      'search',
      'checkout_start',
      'order_completed',
    ];

    if (!eventType || !validEvents.includes(eventType)) {
      return res.status(400).json({ success: false, message: 'Invalid event type' });
    }

    await Analytics.create({
      eventType,
      productId: productId || null,
      sessionId: sessionId || null,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    // Non-blocking for client experience
    console.warn(`[Analytics Warning] Failed to log event: ${error.message}`);
    res.status(200).json({ success: false, logged: false });
  }
};

// @desc    Admin: Get store analytics and product performance
// @route   GET /api/admin/analytics/overview
// @access  Admin only
exports.getAnalyticsOverview = async (req, res, next) => {
  try {
    const [pageViews, prodViews, cartAdds, orders] = await Promise.all([
      Analytics.countDocuments({ eventType: 'page_view' }),
      Analytics.countDocuments({ eventType: 'product_view' }),
      Analytics.countDocuments({ eventType: 'add_to_cart' }),
      Order.countDocuments(),
    ]);

    const conversionRate = prodViews > 0 ? Math.round((orders / prodViews) * 10000) / 100 : 0;
    const cartAddRate = prodViews > 0 ? Math.round((cartAdds / prodViews) * 10000) / 100 : 0;

    // Top viewed products aggregated from Analytics
    const topViews = await Analytics.aggregate([
      { $match: { eventType: 'product_view', productId: { $ne: null } } },
      { $group: { _id: '$productId', totalViews: { $sum: 1 } } },
      { $sort: { totalViews: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 1,
          name: '$product.name',
          category: '$product.category',
          finalPrice: '$product.finalPrice',
          totalViews: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      overview: {
        totalPageViews: pageViews,
        totalProductViews: prodViews,
        totalCartAdds: cartAdds,
        totalOrders: orders,
        conversionRatePercent: conversionRate,
        cartAddRatePercent: cartAddRate,
      },
      topProducts: topViews,
      dailyTrends: [],
    });
  } catch (error) {
    next(error);
  }
};
