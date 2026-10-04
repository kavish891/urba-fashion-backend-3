const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    sessionId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

analyticsSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
