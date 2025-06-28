import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { api } from './api';
import type { ApiResponse } from './api';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
  payment_method?: string;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  orderId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  paymentIntent?: PaymentIntent;
  error?: string;
}

export class PaymentService {
  private static stripe: Stripe | null = null;

  static async getStripe(): Promise<Stripe | null> {
    if (!this.stripe) {
      this.stripe = await stripePromise;
    }
    return this.stripe;
  }

  // Create payment intent on the backend
  static async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<ApiResponse<{ paymentIntent: PaymentIntent }>> {
    const response = await api.post<ApiResponse<{ paymentIntent: PaymentIntent }>>(
      '/payments/create-intent',
      {
        amount: request.amount,
        currency: request.currency || 'usd',
        orderId: request.orderId,
        metadata: request.metadata,
      }
    );
    return response.data;
  }

  // Confirm payment
  static async confirmPayment(
    clientSecret: string,
    paymentMethodId: string
  ): Promise<PaymentResult> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodId,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentIntent: paymentIntent as PaymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment confirmation failed',
      };
    }
  }

  // Process payment with card element
  static async processPayment(
    clientSecret: string,
    cardElement: any
  ): Promise<PaymentResult> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentIntent: paymentIntent as PaymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment processing failed',
      };
    }
  }

  // Get payment methods for a customer
  static async getPaymentMethods(customerId: string): Promise<ApiResponse<{ paymentMethods: any[] }>> {
    const response = await api.get<ApiResponse<{ paymentMethods: any[] }>>(
      `/payments/payment-methods/${customerId}`
    );
    return response.data;
  }

  // Save payment method
  static async savePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ApiResponse<{ paymentMethod: any }>> {
    const response = await api.post<ApiResponse<{ paymentMethod: any }>>(
      '/payments/save-payment-method',
      {
        customerId,
        paymentMethodId,
      }
    );
    return response.data;
  }

  // Process refund
  static async processRefund(
    paymentIntentId: string,
    amount?: number
  ): Promise<ApiResponse<{ refund: any }>> {
    const response = await api.post<ApiResponse<{ refund: any }>>(
      '/payments/refund',
      {
        paymentIntentId,
        amount,
      }
    );
    return response.data;
  }

  // Get payment history
  static async getPaymentHistory(
    customerId: string,
    limit = 10
  ): Promise<ApiResponse<{ payments: PaymentIntent[] }>> {
    const response = await api.get<ApiResponse<{ payments: PaymentIntent[] }>>(
      `/payments/history/${customerId}?limit=${limit}`
    );
    return response.data;
  }

  // Create payment method from card element
  static async createPaymentMethod(cardElement: any): Promise<PaymentResult> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentIntent: paymentMethod as any,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create payment method',
      };
    }
  }

  // Validate card element
  static async validateCard(cardElement: any): Promise<{ valid: boolean; error?: string }> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      // Create a temporary payment method to validate the card
      const { error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        return {
          valid: false,
          error: error.message,
        };
      }

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Card validation failed',
      };
    }
  }

  // Handle payment errors with user-friendly messages
  static getErrorMessage(error: any): string {
    if (!error) return 'An unknown error occurred';

    // Stripe error codes mapping
    const errorMessages: Record<string, string> = {
      card_declined: 'Your card was declined. Please try a different payment method.',
      expired_card: 'Your card has expired. Please use a different card.',
      incorrect_cvc: 'Your card\'s security code is incorrect.',
      processing_error: 'An error occurred while processing your card. Please try again.',
      incorrect_number: 'Your card number is incorrect.',
      invalid_expiry_month: 'Your card\'s expiration month is invalid.',
      invalid_expiry_year: 'Your card\'s expiration year is invalid.',
      invalid_cvc: 'Your card\'s security code is invalid.',
      insufficient_funds: 'Your card has insufficient funds.',
      generic_decline: 'Your card was declined. Please contact your bank for more information.',
      authentication_required: 'Your payment requires authentication. Please complete the verification.',
    };

    // Check if it's a Stripe error with a code
    if (error.code && errorMessages[error.code]) {
      return errorMessages[error.code];
    }

    // Check if it's a Stripe error with a type
    if (error.type) {
      switch (error.type) {
        case 'card_error':
          return error.message || 'There was an issue with your card.';
        case 'validation_error':
          return 'Please check your payment information and try again.';
        case 'api_error':
          return 'We\'re experiencing technical difficulties. Please try again later.';
        case 'authentication_error':
          return 'Authentication failed. Please try again.';
        case 'rate_limit_error':
          return 'Too many requests. Please wait a moment and try again.';
        default:
          return error.message || 'An error occurred while processing your payment.';
      }
    }

    // Fallback to the error message or a generic message
    return error.message || 'An error occurred while processing your payment.';
  }

  // Format amount for display
  static formatAmount(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Convert from cents
  }

  // Validate amount
  static validateAmount(amount: number): { valid: boolean; error?: string } {
    if (!amount || amount <= 0) {
      return { valid: false, error: 'Amount must be greater than zero' };
    }

    if (amount < 50) { // Minimum 50 cents
      return { valid: false, error: 'Amount must be at least $0.50' };
    }

    if (amount > 99999999) { // Maximum $999,999.99
      return { valid: false, error: 'Amount exceeds maximum limit' };
    }

    return { valid: true };
  }

  // Check if payment method requires authentication
  static requiresAuthentication(paymentIntent: PaymentIntent): boolean {
    return paymentIntent.status === 'requires_action' ||
           paymentIntent.status === 'requires_source_action';
  }

  // Get payment status display text
  static getPaymentStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      requires_payment_method: 'Awaiting payment method',
      requires_confirmation: 'Awaiting confirmation',
      requires_action: 'Requires authentication',
      processing: 'Processing payment',
      requires_capture: 'Awaiting capture',
      canceled: 'Payment canceled',
      succeeded: 'Payment successful',
    };

    return statusTexts[status] || status;
  }

  // Get payment status color for UI
  static getPaymentStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      requires_payment_method: '#f59e0b',
      requires_confirmation: '#f59e0b',
      requires_action: '#f59e0b',
      processing: '#3b82f6',
      requires_capture: '#8b5cf6',
      canceled: '#ef4444',
      succeeded: '#10b981',
    };

    return statusColors[status] || '#6b7280';
  }
}

export default PaymentService;
