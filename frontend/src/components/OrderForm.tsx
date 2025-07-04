import React, { useState } from "react";
import { OrderService } from "../services/orderService";
import type {
  CreateOrderRequest,
  Order,
  OrderItem,
  ShippingAddress,
} from "../services/api";
import "./OrderForm.css";

interface OrderFormProps {
  onSuccess?: (order: Order) => void;
  onError?: (error: string) => void;
  initialData?: Partial<CreateOrderRequest>;
  disabled?: boolean;
}

const OrderForm: React.FC<OrderFormProps> = ({
  onSuccess,
  onError,
  initialData,
  disabled = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [items, setItems] = useState<Omit<OrderItem, "totalPrice">[]>(
    initialData?.items || [
      {
        productId: "",
        productName: "",
        quantity: 1,
        unitPrice: 0,
        sku: "",
      },
    ]
  );

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(
    initialData?.shippingAddress || {
      firstName: "",
      lastName: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
    }
  );

  const [paymentMethod, setPaymentMethod] = useState(
    initialData?.payment?.method || "stripe"
  );

  const [notes, setNotes] = useState(initialData?.notes || "");

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        productName: "",
        quantity: 1,
        unitPrice: 0,
        sku: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (
    index: number,
    field: keyof Omit<OrderItem, "totalPrice">,
    value: string | number
  ) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setItems(updatedItems);

    // Clear errors when user starts typing
    if (error) setError("");
    if (fieldErrors[`item-${index}-${field}`]) {
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[`item-${index}-${field}`];
      setFieldErrors(newFieldErrors);
    }
  };

  const updateShippingAddress = (
    field: keyof ShippingAddress,
    value: string
  ) => {
    setShippingAddress({
      ...shippingAddress,
      [field]: value,
    });

    // Clear errors when user starts typing
    if (error) setError("");
    if (fieldErrors[`address-${field}`]) {
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[`address-${field}`];
      setFieldErrors(newFieldErrors);
    }
  };

  const calculateSubtotal = () => {
    return items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0
    );
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
      return "At least one item is required";
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNumber = i + 1;

      if (!item.productId.trim()) {
        return `Item ${itemNumber}: Product ID is required`;
      }
      if (!item.productName.trim()) {
        return `Item ${itemNumber}: Product Name is required`;
      }
      if (!item.quantity || item.quantity <= 0) {
        return `Item ${itemNumber}: Quantity must be greater than 0`;
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        return `Item ${itemNumber}: Unit Price must be greater than 0`;
      }
    }

    // Validate shipping address with specific field names
    const addressFieldLabels: Record<keyof ShippingAddress, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      street: "Street Address",
      city: "City",
      state: "State",
      zipCode: "ZIP Code",
      country: "Country",
      phone: "Phone",
      instructions: "Instructions",
    };

    const requiredAddressFields: (keyof ShippingAddress)[] = [
      "firstName",
      "lastName",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ];

    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]?.trim()) {
        return `Shipping Address: ${addressFieldLabels[field]} is required`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError("");
    setFieldErrors({});

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      // Don't submit to server if validation fails
      return;
    }

    setIsSubmitting(true);

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
          currency: "USD",
        },
        subtotal,
        totalAmount: total,
        tax,
        shipping: {
          cost: 0,
          method: "standard",
        },
        discount: {
          amount: 0,
        },
        notes,
      };

      const response = await OrderService.createOrder(orderData);

      if (response.status === "success") {
        onSuccess?.(response.data.order);
      } else {
        const errorMessage = response.message || "Failed to create order";
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err: any) {
      console.error("Order creation failed:", err);

      // Enhanced error handling to identify validation source
      let errorMessage = "Failed to create order";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
        console.log("Backend validation error:", err.response.data);
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="order-form" noValidate>
      <div className="order-form__section">
        <h3>Order Items</h3>
        {items.map((item, index) => (
          <div key={index} className="order-form__item">
            <div className="order-form__item-fields">
              <input
                type="text"
                placeholder="Product ID"
                value={item.productId}
                onChange={(e) => updateItem(index, "productId", e.target.value)}
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="text"
                placeholder="Product Name"
                value={item.productName}
                onChange={(e) =>
                  updateItem(index, "productName", e.target.value)
                }
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="text"
                placeholder="SKU"
                value={item.sku}
                onChange={(e) => updateItem(index, "sku", e.target.value)}
                disabled={disabled || isSubmitting}
              />
              <input
                type="number"
                placeholder="Quantity"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(index, "quantity", parseInt(e.target.value) || 1)
                }
                disabled={disabled || isSubmitting}
                required
              />
              <input
                type="number"
                placeholder="Unit Price"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) =>
                  updateItem(
                    index,
                    "unitPrice",
                    parseFloat(e.target.value) || 0
                  )
                }
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
            onChange={(e) => updateShippingAddress("firstName", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={shippingAddress.lastName}
            onChange={(e) => updateShippingAddress("lastName", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="Street Address"
            value={shippingAddress.street}
            onChange={(e) => updateShippingAddress("street", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="City"
            value={shippingAddress.city}
            onChange={(e) => updateShippingAddress("city", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="State"
            value={shippingAddress.state}
            onChange={(e) => updateShippingAddress("state", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <input
            type="text"
            placeholder="ZIP Code"
            value={shippingAddress.zipCode}
            onChange={(e) => updateShippingAddress("zipCode", e.target.value)}
            disabled={disabled || isSubmitting}
            required
          />
          <select
            value={shippingAddress.country}
            onChange={(e) => updateShippingAddress("country", e.target.value)}
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
          onChange={(e) => setPaymentMethod(e.target.value as any)}
          disabled={disabled || isSubmitting}
          required
        >
          <option value="stripe">Credit Card (Stripe)</option>
        </select>
      </div>

      <div className="order-form__section">
        <h3>Notes</h3>
        <textarea
          placeholder="Order notes"
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
        <div className="order-form__error" data-testid="order-form-error">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Validation Error
              </h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="order-form__actions">
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className="order-form__submit"
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Creating Order...</span>
            </div>
          ) : (
            "Create Order"
          )}
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
