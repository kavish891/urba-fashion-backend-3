const mongoose = require('mongoose');

const sizeStockSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // e.g. "UK 8", "UK 9", "M", "L", "XL"
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    brand: {
      type: String,
      default: 'Urban Threads',
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['shoes', 'shirts', 'accessories'],
        message: '{VALUE} is not a supported category',
      },
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    originalPrice: {
      type: Number,
      required: [true, 'Original price is required'],
      min: [1, 'Original price must be greater than 0'],
    },
    discount: {
      type: Number,
      min: [0, 'Discount percentage cannot be less than 0'],
      max: [100, 'Discount percentage cannot exceed 100'],
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      index: true,
    },
    sizes: {
      type: [sizeStockSchema],
      validate: {
        validator: function (val) {
          return val && val.length > 0;
        },
        message: 'At least one size with stock must be defined',
      },
    },
    totalStock: {
      type: Number,
      default: 0,
      min: [0, 'Total stock cannot be negative'],
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: '' },
        },
      ],
      validate: {
        validator: function (val) {
          return val && val.length > 0;
        },
        message: 'At least one product image is required',
      },
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-compute finalPrice, totalStock, and slug if missing
productSchema.pre('validate', function (next) {
  if (this.originalPrice != null && this.discount != null) {
    const calculated = this.originalPrice - (this.originalPrice * this.discount) / 100;
    this.finalPrice = Math.round(calculated * 100) / 100;
  }
  if (this.sizes && this.sizes.length > 0) {
    this.totalStock = this.sizes.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0);
  }
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  next();
});

// Composite index for efficient querying of active catalog items
productSchema.index({ isActive: 1, category: 1, finalPrice: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ isActive: 1, isNewArrival: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
