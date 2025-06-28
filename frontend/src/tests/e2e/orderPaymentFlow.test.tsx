import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import OrderForm from '../../components/OrderForm';
import PaymentForm from '../../components/PaymentForm';
import PaymentStatus from '../../components/PaymentStatus';
import { OrderService } from '../../services/orderService';
import { PaymentService } from '../../services/paymentService';

// Mock services
vi.mock('../../services/orderService');
vi.mock('../../services/paymentService');

// Mock Stripe Elements
const mockCardElement = {
  mount: vi.fn(),
  unmount: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  update: vi.fn(),
};

const mockElements = {
  create: vi.fn(() => mockCardElement),
  getElement: vi.fn(() => mockCardElement),
};

const mockStripe = {
  elements: vi.fn(() => mockElements),
  confirmCardPayment: vi.fn(),
  createPaymentMethod: vi.fn(),
};

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="stripe-elements">{children}</div>,
  CardElement: ({ onChange }: any) => (
    <div 
      data-testid="card-element"
      onClick={() => onChange && onChange({ complete: true, error: null })}
    >
      Card Element
    </div>
  ),
  useStripe: () => mockStripe,
  useElements: () => mockElements,
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(mockStripe)),
}));

const mockOrderService = OrderService as any;
const mockPaymentService = PaymentService as any;

describe('End-to-End Order and Payment Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockPaymentService.validateAmount.mockReturnValue({ valid: true });
    mockPaymentService.formatAmount.mockReturnValue('$20.00');
    mockPaymentService.getPaymentStatusText.mockReturnValue('Payment successful');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#10b981');
    mockPaymentService.getErrorMessage.mockImplementation((error: any) => error?.message || 'Unknown error');
  });

  describe('Complete Order-to-Payment Flow', () => {
    it('should handle complete order creation and payment flow', async () => {
      // Mock successful order creation
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'user-123',
        status: 'pending',
        totalAmount: 20.00,
        items: [
          {
            productId: 'prod-123',
            name: 'Test Product',
            quantity: 2,
            unitPrice: 10.00
          }
        ]
      };

      mockOrderService.createOrder.mockResolvedValue({
        status: 'success',
        data: { order: mockOrder }
      });

      // Mock successful payment intent creation
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      mockPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: { paymentIntent: mockPaymentIntent }
      });

      // Mock successful payment processing
      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        paymentIntent: {
          ...mockPaymentIntent,
          status: 'succeeded'
        }
      });

      // Component to simulate the complete flow
      const CompleteFlow: React.FC = () => {
        const [order, setOrder] = React.useState<any>(null);
        const [paymentIntent, setPaymentIntent] = React.useState<any>(null);
        const [paymentComplete, setPaymentComplete] = React.useState(false);

        const handleOrderSuccess = (createdOrder: any) => {
          setOrder(createdOrder);
        };

        const handlePaymentSuccess = (completedPayment: any) => {
          setPaymentIntent(completedPayment);
          setPaymentComplete(true);
        };

        return (
          <div>
            {!order && (
              <div data-testid="order-step">
                <h2>Step 1: Create Order</h2>
                <OrderForm onSuccess={handleOrderSuccess} />
              </div>
            )}
            
            {order && !paymentComplete && (
              <div data-testid="payment-step">
                <h2>Step 2: Process Payment</h2>
                <PaymentForm
                  amount={order.totalAmount * 100} // Convert to cents
                  orderId={order.id}
                  onSuccess={handlePaymentSuccess}
                />
              </div>
            )}
            
            {paymentComplete && paymentIntent && (
              <div data-testid="success-step">
                <h2>Step 3: Payment Complete</h2>
                <PaymentStatus paymentIntent={paymentIntent} showDetails={true} />
              </div>
            )}
          </div>
        );
      };

      render(<CompleteFlow />);

      // Step 1: Fill out and submit order form
      expect(screen.getByTestId('order-step')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Create Order')).toBeInTheDocument();

      // Fill in order details
      fireEvent.change(screen.getByPlaceholderText('Product ID'), { target: { value: 'prod-123' } });
      fireEvent.change(screen.getByPlaceholderText('Product Name'), { target: { value: 'Test Product' } });
      fireEvent.change(screen.getByPlaceholderText('SKU'), { target: { value: 'TEST-SKU' } });
      fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '2' } });
      fireEvent.change(screen.getByPlaceholderText('Unit Price'), { target: { value: '10.00' } });

      fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByPlaceholderText('Street Address'), { target: { value: '123 Main St' } });
      fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'Anytown' } });
      fireEvent.change(screen.getByPlaceholderText('State'), { target: { value: 'CA' } });
      fireEvent.change(screen.getByPlaceholderText('ZIP Code'), { target: { value: '12345' } });

      // Submit order
      fireEvent.click(screen.getByRole('button', { name: /create order/i }));

      // Wait for order creation and payment step
      await waitFor(() => {
        expect(screen.getByTestId('payment-step')).toBeInTheDocument();
        expect(screen.getByText('Step 2: Process Payment')).toBeInTheDocument();
      });

      // Verify order was created
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'prod-123',
              name: 'Test Product',
              quantity: 2,
              unitPrice: 10.00
            })
          ])
        })
      );

      // Step 2: Process payment
      await waitFor(() => {
        expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 2000, // $20.00 in cents
            orderId: 'order-123'
          })
        );
      });

      // Complete card information
      const cardElement = screen.getByTestId('card-element');
      fireEvent.click(cardElement);

      // Submit payment
      const payButton = screen.getByRole('button', { name: /pay/i });
      fireEvent.click(payButton);

      // Wait for payment completion and success step
      await waitFor(() => {
        expect(screen.getByTestId('success-step')).toBeInTheDocument();
        expect(screen.getByText('Step 3: Payment Complete')).toBeInTheDocument();
      });

      // Verify payment was processed
      expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
        'pi_test123_secret',
        mockCardElement
      );

      // Verify success state
      expect(screen.getByText('Payment successful')).toBeInTheDocument();
      expect(screen.getByText('$20.00')).toBeInTheDocument();
    });

    it('should handle payment failure and retry flow', async () => {
      // Mock order creation
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        totalAmount: 20.00
      };

      mockOrderService.createOrder.mockResolvedValue({
        status: 'success',
        data: { order: mockOrder }
      });

      // Mock payment intent creation
      mockPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: {
          paymentIntent: {
            id: 'pi_test123',
            amount: 2000,
            currency: 'usd',
            status: 'requires_payment_method',
            client_secret: 'pi_test123_secret'
          }
        }
      });

      // Mock payment failure then success
      mockPaymentService.processPayment
        .mockResolvedValueOnce({
          success: false,
          error: 'Your card was declined.'
        })
        .mockResolvedValueOnce({
          success: true,
          paymentIntent: {
            id: 'pi_test123',
            status: 'succeeded',
            amount: 2000,
            currency: 'usd'
          }
        });

      const PaymentRetryFlow: React.FC = () => {
        const [paymentAttempts, setPaymentAttempts] = React.useState(0);
        const [paymentSuccess, setPaymentSuccess] = React.useState(false);
        const [error, setError] = React.useState<string>('');

        const handlePaymentError = (errorMessage: string) => {
          setError(errorMessage);
          setPaymentAttempts(prev => prev + 1);
        };

        const handlePaymentSuccess = () => {
          setPaymentSuccess(true);
          setError('');
        };

        return (
          <div>
            {!paymentSuccess && (
              <div>
                <PaymentForm
                  amount={2000}
                  orderId="order-123"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
                {error && (
                  <div data-testid="payment-error">
                    Error: {error}
                    <button onClick={() => setError('')}>Retry Payment</button>
                  </div>
                )}
                <div data-testid="attempt-counter">Attempts: {paymentAttempts}</div>
              </div>
            )}
            {paymentSuccess && (
              <div data-testid="payment-success">Payment Successful!</div>
            )}
          </div>
        );
      };

      render(<PaymentRetryFlow />);

      // Wait for payment form to load
      await waitFor(() => {
        expect(screen.getByTestId('card-element')).toBeInTheDocument();
      });

      // Complete card and submit (first attempt - will fail)
      fireEvent.click(screen.getByTestId('card-element'));
      fireEvent.click(screen.getByRole('button', { name: /pay/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('payment-error')).toBeInTheDocument();
        expect(screen.getByText('Error: Your card was declined.')).toBeInTheDocument();
        expect(screen.getByText('Attempts: 1')).toBeInTheDocument();
      });

      // Retry payment
      fireEvent.click(screen.getByText('Retry Payment'));
      fireEvent.click(screen.getByRole('button', { name: /pay/i }));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByTestId('payment-success')).toBeInTheDocument();
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      });

      expect(mockPaymentService.processPayment).toHaveBeenCalledTimes(2);
    });

    it('should handle order creation failure', async () => {
      // Mock order creation failure
      mockOrderService.createOrder.mockRejectedValue({
        response: {
          data: {
            message: 'Invalid order data'
          }
        }
      });

      const OrderErrorFlow: React.FC = () => {
        const [error, setError] = React.useState<string>('');

        const handleOrderError = (errorMessage: string) => {
          setError(errorMessage);
        };

        return (
          <div>
            <OrderForm onError={handleOrderError} />
            {error && (
              <div data-testid="order-error">
                Order Error: {error}
              </div>
            )}
          </div>
        );
      };

      render(<OrderErrorFlow />);

      // Fill in minimal order details and submit
      fireEvent.change(screen.getByPlaceholderText('Product ID'), { target: { value: 'prod-123' } });
      fireEvent.change(screen.getByPlaceholderText('Product Name'), { target: { value: 'Test Product' } });
      fireEvent.change(screen.getByPlaceholderText('SKU'), { target: { value: 'TEST-SKU' } });
      fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '1' } });
      fireEvent.change(screen.getByPlaceholderText('Unit Price'), { target: { value: '10.00' } });

      fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByPlaceholderText('Street Address'), { target: { value: '123 Main St' } });
      fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'Anytown' } });
      fireEvent.change(screen.getByPlaceholderText('State'), { target: { value: 'CA' } });
      fireEvent.change(screen.getByPlaceholderText('ZIP Code'), { target: { value: '12345' } });

      fireEvent.click(screen.getByRole('button', { name: /create order/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('order-error')).toBeInTheDocument();
        expect(screen.getByText('Order Error: Invalid order data')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Status Display', () => {
    it('should display different payment statuses correctly', () => {
      const paymentIntents = [
        {
          id: 'pi_succeeded',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          client_secret: 'pi_succeeded_secret'
        },
        {
          id: 'pi_processing',
          amount: 1500,
          currency: 'usd',
          status: 'processing',
          client_secret: 'pi_processing_secret'
        },
        {
          id: 'pi_failed',
          amount: 3000,
          currency: 'usd',
          status: 'canceled',
          client_secret: 'pi_failed_secret'
        }
      ];

      mockPaymentService.getPaymentStatusText
        .mockReturnValueOnce('Payment successful')
        .mockReturnValueOnce('Processing payment')
        .mockReturnValueOnce('Payment canceled');

      mockPaymentService.getPaymentStatusColor
        .mockReturnValueOnce('#10b981')
        .mockReturnValueOnce('#3b82f6')
        .mockReturnValueOnce('#ef4444');

      mockPaymentService.formatAmount
        .mockReturnValueOnce('$20.00')
        .mockReturnValueOnce('$15.00')
        .mockReturnValueOnce('$30.00');

      const { rerender } = render(<PaymentStatus paymentIntent={paymentIntents[0]} />);
      expect(screen.getByText('Payment successful')).toBeInTheDocument();
      expect(screen.getByText('$20.00')).toBeInTheDocument();

      rerender(<PaymentStatus paymentIntent={paymentIntents[1]} />);
      expect(screen.getByText('Processing payment')).toBeInTheDocument();
      expect(screen.getByText('$15.00')).toBeInTheDocument();

      rerender(<PaymentStatus paymentIntent={paymentIntents[2]} />);
      expect(screen.getByText('Payment canceled')).toBeInTheDocument();
      expect(screen.getByText('$30.00')).toBeInTheDocument();
    });
  });
});
