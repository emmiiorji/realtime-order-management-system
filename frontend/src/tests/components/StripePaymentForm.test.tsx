import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AppProvider } from '../../contexts/AppContext';
import StripePaymentForm from '../../components/payment/StripePaymentForm';
import PaymentService from '../../services/paymentService';

// Mock Stripe
const mockStripe = {
  confirmCardPayment: vi.fn(),
  elements: vi.fn(),
};

const mockElements = {
  getElement: vi.fn(),
};

const mockCardElement = {
  mount: vi.fn(),
  unmount: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

// Mock Stripe React components
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  useStripe: () => mockStripe,
  useElements: () => mockElements,
  CardElement: () => <div data-testid="card-element">Card Element</div>,
}));

// Mock Stripe.js
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(mockStripe)),
}));

// Mock PaymentService
vi.mock('../../services/paymentService');
const MockedPaymentService = PaymentService as any;

// Mock websocket service
vi.mock('../../services/websocketService', () => ({
  default: {
    subscribeToAll: vi.fn(() => vi.fn()),
    onConnect: vi.fn(() => vi.fn()),
    onDisconnect: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
    getConnectionStatus: vi.fn(() => ({
      connected: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
    })),
  },
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppProvider>{children}</AppProvider>
);

describe('StripePaymentForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    amount: 2000, // $20.00
    currency: 'usd',
    orderId: 'order-123',
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElements.getElement.mockReturnValue(mockCardElement);
  });

  const renderPaymentForm = (props = {}) => {
    return render(
      <TestWrapper>
        <StripePaymentForm {...defaultProps} {...props} />
      </TestWrapper>
    );
  };

  describe('Rendering', () => {
    it('should render payment form with amount and order details', () => {
      renderPaymentForm();

      expect(screen.getByText('Payment Details')).toBeInTheDocument();
      expect(screen.getByText('$20.00 USD')).toBeInTheDocument();
      expect(screen.getByText('order-123')).toBeInTheDocument();
      expect(screen.getByText('Card Details')).toBeInTheDocument();
      expect(screen.getByTestId('card-element')).toBeInTheDocument();
    });

    it('should render without order ID when not provided', () => {
      renderPaymentForm({ orderId: undefined });

      expect(screen.getByText('Payment Details')).toBeInTheDocument();
      expect(screen.getByText('$20.00 USD')).toBeInTheDocument();
      expect(screen.queryByText('Order ID:')).not.toBeInTheDocument();
    });

    it('should render cancel button when onCancel is provided', () => {
      renderPaymentForm();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not render cancel button when onCancel is not provided', () => {
      renderPaymentForm({ onCancel: undefined });

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent when initialize payment is clicked', async () => {
      const user = userEvent.setup();
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret',
      };

      MockedPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: { paymentIntent: mockPaymentIntent },
      });

      renderPaymentForm();

      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(MockedPaymentService.createPaymentIntent).toHaveBeenCalledWith({
          amount: 2000,
          currency: 'usd',
          orderId: 'order-123',
        });
      });

      expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
    });

    it('should handle payment intent creation failure', async () => {
      const user = userEvent.setup();
      
      MockedPaymentService.createPaymentIntent.mockRejectedValue({
        response: {
          data: { message: 'Payment intent creation failed' },
        },
      });

      renderPaymentForm();

      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByText('Payment intent creation failed')).toBeInTheDocument();
      });

      expect(mockOnError).toHaveBeenCalledWith('Payment intent creation failed');
    });
  });

  describe('Payment Processing', () => {
    beforeEach(async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret',
      };

      MockedPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: { paymentIntent: mockPaymentIntent },
      });
    });

    it('should process successful payment', async () => {
      const user = userEvent.setup();
      const mockSuccessfulPayment = {
        success: true,
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded',
          amount: 2000,
          currency: 'usd',
        },
      };

      MockedPaymentService.processPayment.mockResolvedValue(mockSuccessfulPayment);

      renderPaymentForm();

      // Initialize payment first
      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
      });

      // Process payment
      const payButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      await user.click(payButton);

      await waitFor(() => {
        expect(MockedPaymentService.processPayment).toHaveBeenCalledWith(
          'pi_test123_secret',
          mockCardElement
        );
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(mockSuccessfulPayment.paymentIntent);
    });

    it('should handle payment failure', async () => {
      const user = userEvent.setup();
      const mockFailedPayment = {
        success: false,
        error: 'Your card was declined.',
      };

      MockedPaymentService.processPayment.mockResolvedValue(mockFailedPayment);

      renderPaymentForm();

      // Initialize payment first
      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
      });

      // Process payment
      const payButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      await user.click(payButton);

      await waitFor(() => {
        expect(screen.getByText('Your card was declined.')).toBeInTheDocument();
      });

      expect(mockOnError).toHaveBeenCalledWith('Your card was declined.');
    });

    it('should show loading state during payment processing', async () => {
      const user = userEvent.setup();
      
      MockedPaymentService.processPayment.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderPaymentForm();

      // Initialize payment first
      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
      });

      // Process payment
      const payButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      await user.click(payButton);

      expect(screen.getByText(/processing/i)).toBeInTheDocument();
      expect(payButton).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable buttons during processing', async () => {
      const user = userEvent.setup();
      
      MockedPaymentService.createPaymentIntent.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderPaymentForm();

      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      await user.click(initializeButton);

      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing card element', async () => {
      const user = userEvent.setup();
      mockElements.getElement.mockReturnValue(null);

      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret',
      };

      MockedPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: { paymentIntent: mockPaymentIntent },
      });

      renderPaymentForm();

      // Initialize payment first
      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
      });

      // Try to process payment
      const payButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      await user.click(payButton);

      await waitFor(() => {
        expect(screen.getByText('Card element not found')).toBeInTheDocument();
      });
    });

    it('should handle network errors during payment processing', async () => {
      const user = userEvent.setup();
      
      MockedPaymentService.processPayment.mockRejectedValue(
        new Error('Network error')
      );

      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret',
      };

      MockedPaymentService.createPaymentIntent.mockResolvedValue({
        status: 'success',
        data: { paymentIntent: mockPaymentIntent },
      });

      renderPaymentForm();

      // Initialize payment first
      const initializeButton = screen.getByRole('button', { name: /initialize payment/i });
      await user.click(initializeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeInTheDocument();
      });

      // Process payment
      const payButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      await user.click(payButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      expect(mockOnError).toHaveBeenCalledWith('Network error');
    });
  });
});
