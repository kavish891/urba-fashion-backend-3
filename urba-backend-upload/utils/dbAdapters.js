/**
 * Database formatting adapters to map Supabase snake_case rows
 * into the camelCase structures expected by the React frontend and client contracts.
 */

const formatProduct = (p) => {
  if (!p) return null;
  return {
    _id: p.id,
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand || 'Urban Threads',
    category: p.category,
    description: p.description,
    originalPrice: Number(p.original_price),
    discount: Number(p.discount || 0),
    finalPrice: Number(p.final_price),
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    totalStock: Number(p.total_stock || 0),
    images: Array.isArray(p.images) ? p.images : [],
    isFeatured: Boolean(p.is_featured),
    isNewArrival: Boolean(p.is_new_arrival),
    isActive: Boolean(p.is_active),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
};

const isOfflineOrder = (o) => {
  if (!o) return false;
  const notes = (o.notes || '').toLowerCase();
  const payMethod = (o.payment_method || '').toLowerCase();
  const custChannel = (o.customer && typeof o.customer === 'object' ? o.customer.channel : '') || '';
  return (
    notes.includes('[offline sale]') ||
    notes.includes('offline') ||
    payMethod.startsWith('offline') ||
    custChannel === 'offline' ||
    (o.order_number && o.order_number.startsWith('OFF-'))
  );
};

const formatOrder = (o) => {
  if (!o) return null;
  const isOffline = isOfflineOrder(o);
  return {
    _id: o.id,
    id: o.id,
    orderNumber: o.order_number,
    channel: isOffline ? 'offline' : 'online',
    customer: o.customer,
    shippingAddress: o.shipping_address,
    items: Array.isArray(o.items) ? o.items : [],
    subtotal: Number(o.subtotal),
    discount: Number(o.discount || 0),
    total: Number(o.total),
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    orderStatus: o.order_status,
    notes: o.notes || '',
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
};

const formatUser = (u) => {
  if (!u) return null;
  return {
    _id: u.id,
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'customer',
    createdAt: u.created_at,
  };
};

module.exports = {
  formatProduct,
  formatOrder,
  formatUser,
};
