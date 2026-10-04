const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      required: true,
      uppercase: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    originalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: true, // Captured at purchase time
    },
    totalPrice: {
      type: Number,
      required: true, // unitPrice * quantity
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      channel: { type: String, default: 'online' },
    },
    shippingAddress: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: function (val) {
          return val && val.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ['processing', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'processing',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ 'customer.phone': 1 });

module.exports = mongoose.model('Order', orderSchema);
