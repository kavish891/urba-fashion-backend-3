/**
 * Future-Ready Payment Gateway Service Abstraction
 * Currently handles Cash On Delivery (COD) as required.
 * When Razorpay/Stripe is integrated in a future phase, implementations 
 * will hook into createPaymentOrder and verifyWebhookSignature securely on the server.
 */
class PaymentGatewayService {
  /**
   * Generates order payment initialization details
   */
  static async createPaymentOrder({ orderId, amount, currency = 'INR' }) {
    // Architectural hook for Razorpay/Cashfree/Stripe SDK
    // Example: const razorpayOrder = await razorpay.orders.create({ amount: amount * 100, currency, receipt: orderId });
    return {
      gateway: 'none',
      orderId,
      amount,
      currency,
      status: 'pending',
      requiresRedirect: false,
    };
  }

  /**
   * Secure server-side signature verification for future payment webhooks
   * NEVER TRUSTS FRONTEND PAYMENT STATUS MESSAGES.
   */
  static verifyWebhookSignature(payload, signature, secret) {
    // const crypto = require('crypto');
    // const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    return false;
  }
}

module.exports = PaymentGatewayService;
