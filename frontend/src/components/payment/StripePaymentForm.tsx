import { useState } from 'react';
import {
  useStripe,
  useElements,
  CardElement,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentService from '../../services/paymentService';
import { useApp } from '../../contexts/AppContext';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  amount: number;
  currency?: string;
  orderId?: string;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

function PaymentForm({ amount, currency = 'usd', orderId, onSuccess, onError, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { addNotification } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const handleCreatePaymentIntent = async () => {
    try {
      setPaymentError(null);
      const response = await PaymentService.createPaymentIntent({
        amount,
        currency,
        orderId,
      });

      if (response.status === 'success') {
        setClientSecret(response.data.paymentIntent.client_secret);
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to initialize payment';
      setPaymentError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!clientSecret) {
      await handleCreatePaymentIntent();
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setPaymentError('Card element not found');
      setIsProcessing(false);
      return;
    }

    try {
      const result = await PaymentService.processPayment(clientSecret, cardElement);

      if (result.success && result.paymentIntent) {
        addNotification({
          type: 'success',
          title: 'Payment Successful',
          message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`,
        });
        onSuccess?.(result.paymentIntent);
      } else {
        const errorMessage = result.error || 'Payment failed';
        setPaymentError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Payment processing failed';
      setPaymentError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Payment Details
      </h2>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Amount:</span>
          <span className="text-xl font-bold text-gray-900">
            ${(amount / 100).toFixed(2)} {currency.toUpperCase()}
          </span>
        </div>
        {orderId && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-gray-600">Order ID:</span>
            <span className="text-sm text-gray-700">{orderId}</span>
          </div>
        )}
      </div>

      {paymentError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {paymentError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className="p-3 border border-gray-300 rounded-md">
            <CardElement options={cardElementOptions} />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : clientSecret ? (
              `Pay $${(amount / 100).toFixed(2)}`
            ) : (
              'Initialize Payment'
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Your payment information is secure and encrypted.</p>
        <p>Powered by Stripe</p>
      </div>
    </div>
  );
}

// Wrapper component with Stripe Elements provider
export function StripePaymentForm(props: PaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
}

export default StripePaymentForm;
