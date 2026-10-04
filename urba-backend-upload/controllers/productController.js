const Product = require('../models/Product');
const ApiError = require('../utils/apiError');
const { uploadImageBuffer } = require('../services/imageService');
const mongoose = require('mongoose');

// @desc    Get active products for storefront with filtering, sorting, pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const {
      category,
      size,
      minPrice,
      maxPrice,
      search,
      sort,
      isFeatured,
      isNewArrival,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isActive: true };

    if (category && ['shoes', 'shirts', 'accessories'].includes(category.toLowerCase())) {
      filter.category = category.toLowerCase();
    }

    if (minPrice || maxPrice) {
      filter.finalPrice = {};
      if (minPrice) filter.finalPrice.$gte = Number(minPrice);
      if (maxPrice) filter.finalPrice.$lte = Number(maxPrice);
    }

    if (isFeatured === 'true') {
      filter.isFeatured = true;
    }

    if (isNewArrival === 'true') {
      filter.isNewArrival = true;
    }

    if (size) {
      filter['sizes.size'] = size.toUpperCase();
      filter['sizes.stock'] = { $gt: 0 };
    }

    if (search) {
      const sanitized = search.trim();
      filter.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
        { brand: { $regex: sanitized, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { finalPrice: 1 };
    else if (sort === 'price_desc') sortObj = { finalPrice: -1 };
    else if (sort === 'name_asc') sortObj = { name: 1 };
    else if (sort === 'discount') sortObj = { discount: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID or Slug
// @route   GET /api/products/:slugOrId
// @access  Public
exports.getProductBySlugOrId = async (req, res, next) => {
  try {
    const { slugOrId } = req.params;
    let product;

    if (mongoose.Types.ObjectId.isValid(slugOrId)) {
      product = await Product.findOne({ _id: slugOrId, isActive: true });
    }

    if (!product) {
      product = await Product.findOne({ slug: slugOrId.toLowerCase(), isActive: true });
    }

    if (!product) {
      throw new ApiError(404, 'Product not found or inactive');
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all products (active and inactive)
// @route   GET /api/admin/products
// @access  Admin
exports.getAdminProducts = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (category) filter.category = category.toLowerCase();
    if (search) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { brand: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create new product
// @route   POST /api/admin/products
// @access  Admin
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      category,
      description,
      originalPrice,
      discount = 0,
      sizes,
      isFeatured = false,
      isNewArrival = false,
      isActive = true,
    } = req.body;

    let parsedSizes = sizes;
    if (typeof sizes === 'string') {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch (e) {
        throw new ApiError(400, 'Invalid sizes format. Must be valid JSON array.');
      }
    }

    const imageObjects = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadImageBuffer(file.buffer, file.originalname);
        imageObjects.push(uploaded);
      }
    } else if (req.body.imageUrls) {
      const urls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [req.body.imageUrls];
      urls.forEach((url, i) => imageObjects.push({ url, publicId: `url-${i}` }));
    }

    if (imageObjects.length === 0) {
      imageObjects.push({
        url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
        publicId: 'default-placeholder',
      });
    }

    const product = await Product.create({
      name,
      brand: brand || 'Urban Threads',
      category: category.toLowerCase(),
      description,
      originalPrice: Number(originalPrice),
      discount: Number(discount || 0),
      sizes: parsedSizes,
      images: imageObjects,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isNewArrival: isNewArrival === 'true' || isNewArrival === true,
      isActive: isActive === 'true' || isActive === true,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update product
// @route   PUT /api/admin/products/:id
// @access  Admin
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const {
      name,
      brand,
      category,
      description,
      originalPrice,
      discount,
      sizes,
      isFeatured,
      isNewArrival,
      isActive,
      existingImages,
    } = req.body;

    if (name) product.name = name;
    if (brand) product.brand = brand;
    if (category) product.category = category.toLowerCase();
    if (description) product.description = description;
    if (originalPrice !== undefined) product.originalPrice = Number(originalPrice);
    if (discount !== undefined) product.discount = Number(discount);
    if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isNewArrival !== undefined) product.isNewArrival = isNewArrival === 'true' || isNewArrival === true;
    if (isActive !== undefined) product.isActive = isActive === 'true' || isActive === true;

    if (sizes) {
      let parsedSizes = sizes;
      if (typeof sizes === 'string') {
        try {
          parsedSizes = JSON.parse(sizes);
        } catch (e) {
          throw new ApiError(400, 'Invalid sizes format');
        }
      }
      product.sizes = parsedSizes;
    }

    let keptImages = [];
    if (existingImages) {
      const parsed = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      keptImages = Array.isArray(parsed) ? parsed : [];
    } else {
      keptImages = product.images;
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadImageBuffer(file.buffer, file.originalname);
        keptImages.push(uploaded);
      }
    }

    if (keptImages.length > 0) {
      product.images = keptImages;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Soft delete product (set isActive = false)
// @route   DELETE /api/admin/products/:id
// @access  Admin
exports.softDeleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    res.status(200).json({
      success: true,
      message: 'Product archived successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Toggle product active status
// @route   PATCH /api/admin/products/:id/toggle-status
// @access  Admin
exports.toggleProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product is now ${product.isActive ? 'Active' : 'Inactive'}`,
      isActive: product.isActive,
    });
  } catch (error) {
    next(error);
  }
};
