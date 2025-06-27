import React, { useState } from 'react';
import { OrderService } from '../services/orderService';
import type { CreateOrderRequest, Order } from '../services/orderService';

interface OrderFormProps {
  onSuccess?: (order: Order) => void;
  onError?: (error: string) => void;
  initialData?: Partial<CreateOrderRequest>;
  disabled?: boolean;
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  sku: string;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const OrderForm: React.FC<OrderFormProps> = ({
  onSuccess,
  onError,
  initialData,
  disabled = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  
  const [items, setItems] = useState<OrderItem[]>(
    initialData?.items || [
      {
        productId: '',
        name: '',
        quantity: 1,
        unitPrice: 0,
        sku: ''
      }
    ]
  );

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(
    initialData?.shippingAddress || {
      firstName: '',
      lastName: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    }
  );

  const [paymentMethod, setPaymentMethod] = useState(
    initialData?.payment?.method || 'stripe'
  );

  const [notes, setNotes] = useState(initialData?.notes || '');

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        name: '',
        quantity: 1,
        unitPrice: 0,
        sku: ''
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setItems(updatedItems);
  };

  const updateShippingAddress = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress({
      ...shippingAddress,
      [field]: value
    });
  };

  const calculateSubtotal = () => {
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  };

  const calculateTax = (subtotal: number) => {
    return subtotal * 0.08; // 8% tax rate
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    return subtotal + tax;
  };

  const validateForm = (): string | null => {
    // Validate items
    if (items.length === 0) {
      return 'At least one item is required';
    }

    for (const item of items) {
      if (!item.productId || !item.name || item.quantity <= 0 || item.unitPrice <= 0) {
        return 'All item fields are required and must be valid';
      }
    }

    // Validate shipping address
    const requiredAddressFields: (keyof ShippingAddress)[] = [
      'firstName', 'lastName', 'street', 'city', 'state', 'zipCode', 'country'
    ];

    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]) {
        return `${field} is required`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const subtotal = calculateSubtotal();
      const tax = calculateTax(subtotal);
      const total = calculateTotal();

      const orderData: CreateOrderRequest = {
        items,
        shippingAddress,
        billingAddress: shippingAddress, // Use same as shipping for simplicity
        payment: {
          method: paymentMethod as any,
          amount: total,
          currency: 'USD'
        },
        subtotal,
        tax,
        totalAmount: total,
        notes
      };

      const response = await OrderService.createOrder(orderData);
      
      if (response.status === 'success') {
        onSuccess?.(response.data.order);
      } else {
        const errorMessage = response.message || 'Failed to create order';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create order';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="order-form">
      <div className="order-form__section">
        <h3>Order Items</h3>
        {items.map((item, index) => (
          <div key={index} className="order-form__item">
            <div className="order-form__item-fields">
              <input
                type="text"
                placeholder="Product ID"
                value={item.productId}
                onChange={(e) => updateItem(index, 'productId', e.target.value)}
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="text"
                placeholder="Product Name"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="text"
                placeholder="SKU"
                value={item.sku}
                onChange={(e) => updateItem(index, 'sku', e.target.value)}
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="number"
                placeholder="Quantity"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="number"
                placeholder="Unit Price"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                disabled={disabled || isSubmitting}
                required
              />
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={disabled || isSubmitting}
                className="order-form__remove-item"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          disabled={disabled || isSubmitting}
          className="order-form__add-item"
        >
          Add Item
        </button>
      </div>

      <div className="order-form__section">
        <h3>Shipping Address</h3>
        <div className="order-form__address-fields">
          <input
            type="text"
            placeholder="First Name"
            value={shippingAddress.firstName}
            onChange={(e) => updateShippingAddress('firstName', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={shippingAddress.lastName}
            onChange={(e) => updateShippingAddress('lastName', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="Street Address"
            value={shippingAddress.street}
            onChange={(e) => updateShippingAddress('street', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="City"
            value={shippingAddress.city}
            onChange={(e) => updateShippingAddress('city', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="State"
            value={shippingAddress.state}
            onChange={(e) => updateShippingAddress('state', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="ZIP Code"
            value={shippingAddress.zipCode}
            onChange={(e) => updateShippingAddress('zipCode', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <select
            value={shippingAddress.country}
            onChange={(e) => updateShippingAddress('country', e.target.value)}
            disabled={disabled || isSubmitting}
            required
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
          </select>
        </div>
      </div>

      <div className="order-form__section">
        <h3>Payment Method</h3>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          disabled={disabled || isSubmitting}
          required
        >
          <option value="stripe">Credit Card (Stripe)</option>
          <option value="paypal">PayPal</option>
          <option value="cash_on_delivery">Cash on Delivery</option>
        </select>
      </div>

      <div className="order-form__section">
        <h3>Notes</h3>
        <textarea
          placeholder="Order notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled || isSubmitting}
          rows={3}
        />
      </div>

      <div className="order-form__summary">
        <div className="order-form__summary-line">
          <span>Subtotal:</span>
          <span>${calculateSubtotal().toFixed(2)}</span>
        </div>
        <div className="order-form__summary-line">
          <span>Tax:</span>
          <span>${calculateTax(calculateSubtotal()).toFixed(2)}</span>
        </div>
        <div className="order-form__summary-line order-form__summary-total">
          <span>Total:</span>
          <span>${calculateTotal().toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="order-form__error">
          {error}
        </div>
      )}

      <div className="order-form__actions">
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className="order-form__submit"
        >
          {isSubmitting ? 'Creating Order...' : 'Create Order'}
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
