import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PaymentStatus from '../../components/PaymentStatus';
import { PaymentService } from '../../services/paymentService';

// Mock PaymentService
vi.mock('../../services/paymentService', () => ({
  PaymentService: {
    getPaymentStatusText: vi.fn(),
    getPaymentStatusColor: vi.fn(),
    formatAmount: vi.fn(),
  },
}));

const mockPaymentService = PaymentService as any;

describe('PaymentStatus', () => {
  const mockPaymentIntent = {
    id: 'pi_test123',
    amount: 2000,
    currency: 'usd',
    status: 'succeeded',
    client_secret: 'pi_test123_secret'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockPaymentService.getPaymentStatusText.mockReturnValue('Payment successful');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#10b981');
    mockPaymentService.formatAmount.mockReturnValue('$20.00');
  });

  it('should render payment status with basic information', () => {
    render(<PaymentStatus paymentIntent={mockPaymentIntent} />);

    expect(screen.getByText('Payment successful')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();

    expect(mockPaymentService.getPaymentStatusText).toHaveBeenCalledWith('succeeded');
    expect(mockPaymentService.getPaymentStatusColor).toHaveBeenCalledWith('succeeded');
    expect(mockPaymentService.formatAmount).toHaveBeenCalledWith(2000, 'usd');
  });

  it('should show details when showDetails is true', () => {
    render(<PaymentStatus paymentIntent={mockPaymentIntent} showDetails={true} />);

    expect(screen.getByText('Payment ID:')).toBeInTheDocument();
    expect(screen.getByText('pi_test123')).toBeInTheDocument();
    expect(screen.getByText('Currency:')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
  });

  it('should not show details when showDetails is false', () => {
    render(<PaymentStatus paymentIntent={mockPaymentIntent} showDetails={false} />);

    expect(screen.queryByText('Payment ID:')).not.toBeInTheDocument();
    expect(screen.queryByText('Currency:')).not.toBeInTheDocument();
    expect(screen.queryByText('Status:')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PaymentStatus 
        paymentIntent={mockPaymentIntent} 
        className="custom-class" 
      />
    );

    expect(container.firstChild).toHaveClass('payment-status', 'custom-class');
  });

  it('should render success icon for succeeded status', () => {
    render(<PaymentStatus paymentIntent={mockPaymentIntent} />);

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('payment-status__icon');
  });

  it('should render processing icon for processing status', () => {
    const processingPaymentIntent = {
      ...mockPaymentIntent,
      status: 'processing'
    };

    mockPaymentService.getPaymentStatusText.mockReturnValue('Processing payment');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#3b82f6');

    render(<PaymentStatus paymentIntent={processingPaymentIntent} />);

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toHaveClass('payment-status__icon', 'payment-status__icon--spinning');
  });

  it('should render error icon for canceled status', () => {
    const canceledPaymentIntent = {
      ...mockPaymentIntent,
      status: 'canceled'
    };

    mockPaymentService.getPaymentStatusText.mockReturnValue('Payment canceled');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#ef4444');

    render(<PaymentStatus paymentIntent={canceledPaymentIntent} />);

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('payment-status__icon');
  });

  it('should render warning icon for requires_action status', () => {
    const actionRequiredPaymentIntent = {
      ...mockPaymentIntent,
      status: 'requires_action'
    };

    mockPaymentService.getPaymentStatusText.mockReturnValue('Requires authentication');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#f59e0b');

    render(<PaymentStatus paymentIntent={actionRequiredPaymentIntent} />);

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('payment-status__icon');
  });

  it('should render default icon for unknown status', () => {
    const unknownPaymentIntent = {
      ...mockPaymentIntent,
      status: 'unknown_status'
    };

    mockPaymentService.getPaymentStatusText.mockReturnValue('unknown_status');
    mockPaymentService.getPaymentStatusColor.mockReturnValue('#6b7280');

    render(<PaymentStatus paymentIntent={unknownPaymentIntent} />);

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('payment-status__icon');
  });

  it('should set CSS custom property for status color', () => {
    const { container } = render(<PaymentStatus paymentIntent={mockPaymentIntent} />);

    const statusElement = container.firstChild as HTMLElement;
    expect(statusElement.style.getPropertyValue('--status-color')).toBe('#10b981');
  });

  it('should handle different currencies correctly', () => {
    const eurPaymentIntent = {
      ...mockPaymentIntent,
      currency: 'eur'
    };

    mockPaymentService.formatAmount.mockReturnValue('€20.00');

    render(<PaymentStatus paymentIntent={eurPaymentIntent} />);

    expect(mockPaymentService.formatAmount).toHaveBeenCalledWith(2000, 'eur');
    expect(screen.getByText('€20.00')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('should display currency in uppercase in details', () => {
    const lowercaseCurrencyPaymentIntent = {
      ...mockPaymentIntent,
      currency: 'gbp'
    };

    render(<PaymentStatus paymentIntent={lowercaseCurrencyPaymentIntent} showDetails={true} />);

    expect(screen.getByText('GBP')).toBeInTheDocument();
  });

  it('should handle large amounts correctly', () => {
    const largeAmountPaymentIntent = {
      ...mockPaymentIntent,
      amount: 999999999
    };

    mockPaymentService.formatAmount.mockReturnValue('$9,999,999.99');

    render(<PaymentStatus paymentIntent={largeAmountPaymentIntent} />);

    expect(mockPaymentService.formatAmount).toHaveBeenCalledWith(999999999, 'usd');
    expect(screen.getByText('$9,999,999.99')).toBeInTheDocument();
  });

  it('should handle zero amount', () => {
    const zeroAmountPaymentIntent = {
      ...mockPaymentIntent,
      amount: 0
    };

    mockPaymentService.formatAmount.mockReturnValue('$0.00');

    render(<PaymentStatus paymentIntent={zeroAmountPaymentIntent} />);

    expect(mockPaymentService.formatAmount).toHaveBeenCalledWith(0, 'usd');
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('should be accessible with proper ARIA attributes', () => {
    render(<PaymentStatus paymentIntent={mockPaymentIntent} />);

    const statusElement = screen.getByText('Payment successful').closest('.payment-status');
    expect(statusElement).toBeInTheDocument();
    
    // The component should be focusable for accessibility
    expect(statusElement).toHaveAttribute('tabIndex', '0');
  });

  it('should handle missing payment intent gracefully', () => {
    const incompletePaymentIntent = {
      id: 'pi_test123',
      amount: 2000,
      currency: 'usd',
      status: 'succeeded'
      // Missing client_secret
    } as any;

    render(<PaymentStatus paymentIntent={incompletePaymentIntent} />);

    expect(screen.getByText('Payment successful')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });
});
