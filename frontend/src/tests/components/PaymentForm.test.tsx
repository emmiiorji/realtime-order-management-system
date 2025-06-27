import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PaymentForm from '../../components/PaymentForm';
import { PaymentService } from '../../services/paymentService';

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

// Mock PaymentService
vi.mock('../../services/paymentService', () => ({
  PaymentService: {
    createPaymentIntent: vi.fn(),
    processPayment: vi.fn(),
    savePaymentMethod: vi.fn(),
    validateAmount: vi.fn(),
    formatAmount: vi.fn(),
    getErrorMessage: vi.fn(),
    getPaymentStatusText: vi.fn(),
  },
}));

const mockPaymentService = PaymentService as any;

describe('PaymentForm', () => {
  const defaultProps = {
    amount: 2000,
    currency: 'usd',
    onSuccess: vi.fn(),
    onError: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockPaymentService.validateAmount.mockReturnValue({ valid: true });
    mockPaymentService.formatAmount.mockReturnValue('$20.00');
    mockPaymentService.getPaymentStatusText.mockReturnValue('Awaiting payment method');
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
  });

  it('should render payment form with correct amount', async () => {
    render(<PaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Information')).toBeInTheDocument();
      expect(screen.getByText('Total: $20.00')).toBeInTheDocument();
      expect(screen.getByTestId('card-element')).toBeInTheDocument();
    });
  });

  it('should create payment intent on mount', async () => {
    render(<PaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        orderId: undefined,
        metadata: {
          customerId: '',
          source: 'payment_form'
        }
      });
    });
  });

  it('should handle invalid amount', async () => {
    mockPaymentService.validateAmount.mockReturnValue({
      valid: false,
      error: 'Amount must be greater than zero'
    });

    render(<PaymentForm {...defaultProps} amount={0} />);

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than zero')).toBeInTheDocument();
    });

    expect(defaultProps.onError).toHaveBeenCalledWith('Amount must be greater than zero');
  });

  it('should handle payment intent creation failure', async () => {
    mockPaymentService.createPaymentIntent.mockResolvedValue({
      status: 'error',
      message: 'Failed to create payment intent'
    });

    render(<PaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to initialize payment')).toBeInTheDocument();
    });

    expect(defaultProps.onError).toHaveBeenCalledWith('Failed to initialize payment');
  });

  it('should enable submit button when card is complete', async () => {
    render(<PaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pay \$20\.00/i })).toBeDisabled();
    });

    // Simulate card completion
    const cardElement = screen.getByTestId('card-element');
    fireEvent.click(cardElement);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pay \$20\.00/i })).not.toBeDisabled();
    });
  });

  it('should process payment on form submission', async () => {
    mockPaymentService.processPayment.mockResolvedValue({
      success: true,
      paymentIntent: {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd'
      }
    });

    render(<PaymentForm {...defaultProps} />);

    // Wait for payment intent to be created
    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalled();
    });

    // Complete the card
    const cardElement = screen.getByTestId('card-element');
    fireEvent.click(cardElement);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /pay \$20\.00/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
        'pi_test123_secret',
        mockCardElement
      );
    });

    expect(defaultProps.onSuccess).toHaveBeenCalledWith({
      id: 'pi_test123',
      status: 'succeeded',
      amount: 2000,
      currency: 'usd'
    });
  });

  it('should handle payment processing failure', async () => {
    mockPaymentService.processPayment.mockResolvedValue({
      success: false,
      error: 'Your card was declined.'
    });
    mockPaymentService.getErrorMessage.mockReturnValue('Your card was declined.');

    render(<PaymentForm {...defaultProps} />);

    // Wait for payment intent and complete card
    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalled();
    });

    const cardElement = screen.getByTestId('card-element');
    fireEvent.click(cardElement);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /pay \$20\.00/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Your card was declined.')).toBeInTheDocument();
    });

    expect(defaultProps.onError).toHaveBeenCalledWith('Your card was declined.');
  });

  it('should show save card option when enabled', async () => {
    render(
      <PaymentForm 
        {...defaultProps} 
        showSaveCard={true} 
        customerId="cus_test123" 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save this card for future payments')).toBeInTheDocument();
    });
  });

  it('should save payment method when requested', async () => {
    mockPaymentService.processPayment.mockResolvedValue({
      success: true,
      paymentIntent: {
        id: 'pi_test123',
        status: 'succeeded',
        payment_method: 'pm_test123'
      }
    });
    mockPaymentService.savePaymentMethod.mockResolvedValue({
      status: 'success'
    });

    render(
      <PaymentForm 
        {...defaultProps} 
        showSaveCard={true} 
        customerId="cus_test123" 
      />
    );

    // Wait for setup and complete card
    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalled();
    });

    const cardElement = screen.getByTestId('card-element');
    fireEvent.click(cardElement);

    // Check save card option
    const saveCardCheckbox = screen.getByRole('checkbox');
    fireEvent.click(saveCardCheckbox);

    // Submit payment
    const submitButton = screen.getByRole('button', { name: /pay \$20\.00/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPaymentService.savePaymentMethod).toHaveBeenCalledWith(
        'cus_test123',
        'pm_test123'
      );
    });
  });

  it('should handle cancel button click', async () => {
    render(<PaymentForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('should disable form when disabled prop is true', async () => {
    render(<PaymentForm {...defaultProps} disabled={true} />);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /pay \$20\.00/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('should show processing state during payment', async () => {
    mockPaymentService.processPayment.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, paymentIntent: {} }), 100))
    );

    render(<PaymentForm {...defaultProps} />);

    // Setup and complete card
    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalled();
    });

    const cardElement = screen.getByTestId('card-element');
    fireEvent.click(cardElement);

    // Submit payment
    const submitButton = screen.getByRole('button', { name: /pay \$20\.00/i });
    fireEvent.click(submitButton);

    // Check processing state
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should include orderId in payment intent request when provided', async () => {
    render(<PaymentForm {...defaultProps} orderId="order-123" />);

    await waitFor(() => {
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        orderId: 'order-123',
        metadata: {
          customerId: '',
          source: 'payment_form'
        }
      });
    });
  });
});
