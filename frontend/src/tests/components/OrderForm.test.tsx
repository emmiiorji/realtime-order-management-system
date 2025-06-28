
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import OrderForm from '../../components/OrderForm';
import { OrderService } from '../../services/orderService';

// Mock OrderService
vi.mock('../../services/orderService', () => ({
  OrderService: {
    createOrder: vi.fn(),
  },
}));

const mockOrderService = OrderService as any;

describe('OrderForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render order form with default values', () => {
    render(<OrderForm {...defaultProps} />);

    expect(screen.getByText('Order Items')).toBeInTheDocument();
    expect(screen.getByText('Shipping Address')).toBeInTheDocument();
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText('Product ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('stripe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument();
  });

  it('should render with initial data', () => {
    const initialData = {
      items: [
        {
          productId: 'prod-123',
          productName: 'Test Product',
          quantity: 2,
          unitPrice: 10.00,
          sku: 'TEST-SKU'
        }
      ],
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US'
      },
      payment: {
        method: 'paypal' as const,
        amount: 20.00,
        currency: 'USD'
      },
      notes: 'Test order notes'
    };

    render(<OrderForm {...defaultProps} initialData={initialData} />);

    expect(screen.getByDisplayValue('prod-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('paypal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test order notes')).toBeInTheDocument();
  });

  it('should add and remove items', () => {
    render(<OrderForm {...defaultProps} />);

    // Initially should have one item
    expect(screen.getAllByPlaceholderText('Product ID')).toHaveLength(1);

    // Add item
    const addButton = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addButton);

    expect(screen.getAllByPlaceholderText('Product ID')).toHaveLength(2);

    // Remove item
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText('Product ID')).toHaveLength(1);
  });

  it('should not allow removing the last item', () => {
    render(<OrderForm {...defaultProps} />);

    // Should not show remove button when there's only one item
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('should update item fields', () => {
    render(<OrderForm {...defaultProps} />);

    const productIdInput = screen.getByPlaceholderText('Product ID');
    const productNameInput = screen.getByPlaceholderText('Product Name');
    const quantityInput = screen.getByPlaceholderText('Quantity');
    const priceInput = screen.getByPlaceholderText('Unit Price');

    fireEvent.change(productIdInput, { target: { value: 'prod-123' } });
    fireEvent.change(productNameInput, { target: { value: 'Test Product' } });
    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '10.50' } });

    expect(productIdInput).toHaveValue('prod-123');
    expect(productNameInput).toHaveValue('Test Product');
    expect(quantityInput).toHaveValue(2);
    expect(priceInput).toHaveValue(10.5);
  });

  it('should update shipping address fields', () => {
    render(<OrderForm {...defaultProps} />);

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const streetInput = screen.getByPlaceholderText('Street Address');

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(streetInput, { target: { value: '123 Main St' } });

    expect(firstNameInput).toHaveValue('John');
    expect(lastNameInput).toHaveValue('Doe');
    expect(streetInput).toHaveValue('123 Main St');
  });

  it('should calculate totals correctly', () => {
    render(<OrderForm {...defaultProps} />);

    // Fill in item details
    const quantityInput = screen.getByPlaceholderText('Quantity');
    const priceInput = screen.getByPlaceholderText('Unit Price');

    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '10.00' } });

    // Check calculated totals (2 * 10.00 = 20.00, tax = 1.60, total = 21.60)
    expect(screen.getByText('$20.00')).toBeInTheDocument(); // Subtotal
    expect(screen.getByText('$1.60')).toBeInTheDocument(); // Tax (8%)
    expect(screen.getByText('$21.60')).toBeInTheDocument(); // Total
  });

  it('should submit order successfully', async () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-001',
      status: 'pending'
    };

    mockOrderService.createOrder.mockResolvedValue({
      status: 'success',
      data: { order: mockOrder }
    });

    render(<OrderForm {...defaultProps} />);

    // Fill in required fields
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

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create order/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              productId: 'prod-123',
              productName: 'Test Product',
              sku: 'TEST-SKU',
              quantity: 1,
              unitPrice: 10.00
            })
          ],
          shippingAddress: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'US'
          }),
          payment: expect.objectContaining({
            method: 'stripe',
            amount: 10.80, // 10.00 + 0.80 tax
            currency: 'USD'
          })
        })
      );
    });

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(mockOrder);
  });

  it('should handle validation errors', async () => {
    render(<OrderForm {...defaultProps} />);

    // Submit form without filling required fields
    const submitButton = screen.getByRole('button', { name: /create order/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('order-form-error')).toBeInTheDocument();
      expect(screen.getByTestId('order-form-error')).toHaveTextContent(/All item fields are required and must be valid/i);
    });

    expect(defaultProps.onError).toHaveBeenCalledWith(
      expect.stringContaining('All item fields are required')
    );
    expect(mockOrderService.createOrder).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    mockOrderService.createOrder.mockRejectedValue({
      response: {
        data: {
          message: 'Invalid order data'
        }
      }
    });

    render(<OrderForm {...defaultProps} />);

    // Fill in required fields
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

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create order/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid order data')).toBeInTheDocument();
    });

    expect(defaultProps.onError).toHaveBeenCalledWith('Invalid order data');
  });

  it('should disable form when disabled prop is true', () => {
    render(<OrderForm {...defaultProps} disabled={true} />);

    expect(screen.getByPlaceholderText('Product ID')).toBeDisabled();
    expect(screen.getByPlaceholderText('First Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: /create order/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled();
  });

  it('should show loading state during submission', async () => {
    mockOrderService.createOrder.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ status: 'success', data: { order: {} } }), 100))
    );

    render(<OrderForm {...defaultProps} />);

    // Fill in required fields and submit
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

    const submitButton = screen.getByRole('button', { name: /create order/i });
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('Creating Order...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});
