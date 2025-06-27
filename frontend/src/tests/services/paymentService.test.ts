import { vi } from 'vitest';
import PaymentService from '../../services/paymentService';
import { api } from '../../services/api';

// Mock Stripe
const mockStripe = {
  confirmCardPayment: vi.fn(),
  createPaymentMethod: vi.fn(),
};

// Mock the API
vi.mock('../../services/api');
const mockedApi = api as any;



vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(mockStripe)),
}));

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            paymentIntent: {
              id: 'pi_test123',
              amount: 2000,
              currency: 'usd',
              status: 'requires_payment_method',
              client_secret: 'pi_test123_secret',
            },
          },
        },
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const request = {
        amount: 2000,
        currency: 'usd',
        orderId: 'order-123',
        metadata: { userId: 'user-456' },
      };

      const result = await PaymentService.createPaymentIntent(request);

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/create-intent', {
        amount: 2000,
        currency: 'usd',
        orderId: 'order-123',
        metadata: { userId: 'user-456' },
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should use default currency when not provided', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            paymentIntent: {
              id: 'pi_test123',
              amount: 1000,
              currency: 'usd',
              status: 'requires_payment_method',
              client_secret: 'pi_test123_secret',
            },
          },
        },
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const request = {
        amount: 1000,
      };

      await PaymentService.createPaymentIntent(request);

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/create-intent', {
        amount: 1000,
        currency: 'usd',
        orderId: undefined,
        metadata: undefined,
      });
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockedApi.post.mockRejectedValue(mockError);

      const request = { amount: 2000 };

      await expect(PaymentService.createPaymentIntent(request)).rejects.toThrow('API Error');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd',
      };

      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: mockPaymentIntent,
        error: null,
      });

      const result = await PaymentService.confirmPayment('pi_test123_secret', 'pm_test456');

      expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith('pi_test123_secret', {
        payment_method: 'pm_test456',
      });

      expect(result).toEqual({
        success: true,
        paymentIntent: mockPaymentIntent,
      });
    });

    it('should handle Stripe errors', async () => {
      const mockError = {
        message: 'Your card was declined.',
        type: 'card_error',
        code: 'card_declined',
      };

      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: null,
        error: mockError,
      });

      const result = await PaymentService.confirmPayment('pi_test123_secret', 'pm_test456');

      expect(result).toEqual({
        success: false,
        error: 'Your card was declined.',
      });
    });

    it('should handle when Stripe is not initialized', async () => {
      // Mock getStripe to return null
      vi.spyOn(PaymentService, 'getStripe').mockResolvedValue(null);

      const result = await PaymentService.confirmPayment('pi_test123_secret', 'pm_test456');

      expect(result).toEqual({
        success: false,
        error: 'Stripe not initialized',
      });
    });

    it('should handle unexpected errors', async () => {
      mockStripe.confirmCardPayment.mockRejectedValue(new Error('Network error'));

      const result = await PaymentService.confirmPayment('pi_test123_secret', 'pm_test456');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('processPayment', () => {
    const mockCardElement = {
      mount: vi.fn(),
      unmount: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    it('should process payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd',
      };

      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: mockPaymentIntent,
        error: null,
      });

      const result = await PaymentService.processPayment('pi_test123_secret', mockCardElement);

      expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith('pi_test123_secret', {
        payment_method: {
          card: mockCardElement,
        },
      });

      expect(result).toEqual({
        success: true,
        paymentIntent: mockPaymentIntent,
      });
    });

    it('should handle payment processing errors', async () => {
      const mockError = {
        message: 'Insufficient funds.',
        type: 'card_error',
        code: 'insufficient_funds',
      };

      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: null,
        error: mockError,
      });

      const result = await PaymentService.processPayment('pi_test123_secret', mockCardElement);

      expect(result).toEqual({
        success: false,
        error: 'Insufficient funds.',
      });
    });
  });

  describe('getPaymentMethods', () => {
    it('should get payment methods successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            paymentMethods: [
              {
                id: 'pm_test123',
                type: 'card',
                card: {
                  brand: 'visa',
                  last4: '4242',
                  exp_month: 12,
                  exp_year: 2025,
                },
              },
            ],
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await PaymentService.getPaymentMethods('cus_test123');

      expect(mockedApi.get).toHaveBeenCalledWith('/payments/payment-methods/cus_test123');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('savePaymentMethod', () => {
    it('should save payment method successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            paymentMethod: {
              id: 'pm_test123',
              type: 'card',
              card: {
                brand: 'visa',
                last4: '4242',
              },
            },
          },
        },
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await PaymentService.savePaymentMethod('cus_test123', 'pm_test456');

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/save-payment-method', {
        customerId: 'cus_test123',
        paymentMethodId: 'pm_test456',
      });

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            refund: {
              id: 're_test123',
              amount: 1000,
              status: 'succeeded',
              payment_intent: 'pi_test123',
            },
          },
        },
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await PaymentService.processRefund('pi_test123', 1000);

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/refund', {
        paymentIntentId: 'pi_test123',
        amount: 1000,
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should process full refund when amount not provided', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            refund: {
              id: 're_test123',
              amount: 2000,
              status: 'succeeded',
              payment_intent: 'pi_test123',
            },
          },
        },
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await PaymentService.processRefund('pi_test123');

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/refund', {
        paymentIntentId: 'pi_test123',
        amount: undefined,
      });
    });
  });

  describe('getPaymentHistory', () => {
    it('should get payment history successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            payments: [
              {
                id: 'pi_test123',
                amount: 2000,
                currency: 'usd',
                status: 'succeeded',
                created: 1234567890,
              },
              {
                id: 'pi_test456',
                amount: 1500,
                currency: 'usd',
                status: 'succeeded',
                created: 1234567800,
              },
            ],
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await PaymentService.getPaymentHistory('cus_test123', 5);

      expect(mockedApi.get).toHaveBeenCalledWith('/payments/history/cus_test123?limit=5');
      expect(result).toEqual(mockResponse.data);
    });

    it('should use default limit when not provided', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: { payments: [] },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await PaymentService.getPaymentHistory('cus_test123');

      expect(mockedApi.get).toHaveBeenCalledWith('/payments/history/cus_test123?limit=10');
    });
  });

  describe('createPaymentMethod', () => {
    it('should create payment method successfully', async () => {
      const mockCardElement = { type: 'card' };
      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card',
        card: { brand: 'visa', last4: '4242' }
      };

      mockStripe.createPaymentMethod.mockResolvedValue({
        error: null,
        paymentMethod: mockPaymentMethod
      });

      const result = await PaymentService.createPaymentMethod(mockCardElement);

      expect(result.success).toBe(true);
      expect(result.paymentIntent).toEqual(mockPaymentMethod);
      expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith({
        type: 'card',
        card: mockCardElement
      });
    });

    it('should handle payment method creation error', async () => {
      const mockCardElement = { type: 'card' };
      const mockError = { message: 'Your card number is incorrect.' };

      mockStripe.createPaymentMethod.mockResolvedValue({
        error: mockError,
        paymentMethod: null
      });

      const result = await PaymentService.createPaymentMethod(mockCardElement);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Your card number is incorrect.');
    });

    it('should handle Stripe not initialized', async () => {
      const originalGetStripe = PaymentService.getStripe;
      PaymentService.getStripe = vi.fn().mockResolvedValue(null);

      const result = await PaymentService.createPaymentMethod({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe not initialized');

      PaymentService.getStripe = originalGetStripe;
    });
  });

  describe('validateCard', () => {
    it('should validate card successfully', async () => {
      const mockCardElement = { type: 'card' };

      mockStripe.createPaymentMethod.mockResolvedValue({
        error: null,
        paymentMethod: { id: 'pm_test123' }
      });

      const result = await PaymentService.validateCard(mockCardElement);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return validation error for invalid card', async () => {
      const mockCardElement = { type: 'card' };
      const mockError = { message: 'Your card number is incomplete.' };

      mockStripe.createPaymentMethod.mockResolvedValue({
        error: mockError,
        paymentMethod: null
      });

      const result = await PaymentService.validateCard(mockCardElement);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Your card number is incomplete.');
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly message for card_declined error', () => {
      const error = { code: 'card_declined' };
      const message = PaymentService.getErrorMessage(error);
      expect(message).toBe('Your card was declined. Please try a different payment method.');
    });

    it('should return user-friendly message for expired_card error', () => {
      const error = { code: 'expired_card' };
      const message = PaymentService.getErrorMessage(error);
      expect(message).toBe('Your card has expired. Please use a different card.');
    });

    it('should return message for card_error type', () => {
      const error = { type: 'card_error', message: 'Custom card error' };
      const message = PaymentService.getErrorMessage(error);
      expect(message).toBe('Custom card error');
    });

    it('should return generic message for unknown error', () => {
      const error = { type: 'unknown_error' };
      const message = PaymentService.getErrorMessage(error);
      expect(message).toBe('An error occurred while processing your payment.');
    });

    it('should handle null/undefined error', () => {
      const message = PaymentService.getErrorMessage(null);
      expect(message).toBe('An unknown error occurred');
    });
  });

  describe('formatAmount', () => {
    it('should format USD amount correctly', () => {
      const formatted = PaymentService.formatAmount(2000, 'USD');
      expect(formatted).toBe('$20.00');
    });

    it('should format EUR amount correctly', () => {
      const formatted = PaymentService.formatAmount(1500, 'EUR');
      expect(formatted).toBe('€15.00');
    });

    it('should use default USD currency', () => {
      const formatted = PaymentService.formatAmount(1000);
      expect(formatted).toBe('$10.00');
    });

    it('should handle zero amount', () => {
      const formatted = PaymentService.formatAmount(0);
      expect(formatted).toBe('$0.00');
    });
  });

  describe('validateAmount', () => {
    it('should validate valid amount', () => {
      const result = PaymentService.validateAmount(1000);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject zero amount', () => {
      const result = PaymentService.validateAmount(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('should reject negative amount', () => {
      const result = PaymentService.validateAmount(-100);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('should reject amount below minimum', () => {
      const result = PaymentService.validateAmount(25);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be at least $0.50');
    });

    it('should reject amount above maximum', () => {
      const result = PaymentService.validateAmount(100000000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount exceeds maximum limit');
    });
  });

  describe('requiresAuthentication', () => {
    it('should return true for requires_action status', () => {
      const paymentIntent = { status: 'requires_action' } as any;
      expect(PaymentService.requiresAuthentication(paymentIntent)).toBe(true);
    });

    it('should return true for requires_source_action status', () => {
      const paymentIntent = { status: 'requires_source_action' } as any;
      expect(PaymentService.requiresAuthentication(paymentIntent)).toBe(true);
    });

    it('should return false for succeeded status', () => {
      const paymentIntent = { status: 'succeeded' } as any;
      expect(PaymentService.requiresAuthentication(paymentIntent)).toBe(false);
    });
  });

  describe('getPaymentStatusText', () => {
    it('should return correct text for known statuses', () => {
      expect(PaymentService.getPaymentStatusText('succeeded')).toBe('Payment successful');
      expect(PaymentService.getPaymentStatusText('processing')).toBe('Processing payment');
      expect(PaymentService.getPaymentStatusText('canceled')).toBe('Payment canceled');
    });

    it('should return original status for unknown status', () => {
      expect(PaymentService.getPaymentStatusText('unknown_status')).toBe('unknown_status');
    });
  });

  describe('getPaymentStatusColor', () => {
    it('should return correct colors for known statuses', () => {
      expect(PaymentService.getPaymentStatusColor('succeeded')).toBe('#10b981');
      expect(PaymentService.getPaymentStatusColor('processing')).toBe('#3b82f6');
      expect(PaymentService.getPaymentStatusColor('canceled')).toBe('#ef4444');
    });

    it('should return default color for unknown status', () => {
      expect(PaymentService.getPaymentStatusColor('unknown_status')).toBe('#6b7280');
    });
  });
});
