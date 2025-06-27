import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { PaymentService } from '../services/paymentService';
import type { PaymentIntent, CreatePaymentIntentRequest } from '../services/paymentService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  amount: number;
  currency?: string;
  orderId?: string;
  onSuccess?: (paymentIntent: PaymentIntent) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  showSaveCard?: boolean;
  customerId?: string;
}

interface PaymentFormInternalProps extends PaymentFormProps {
  // Internal props for the form component
}

const PaymentFormInternal: React.FC<PaymentFormInternalProps> = ({
  amount,
  currency = 'usd',
  orderId,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  showSaveCard = false,
  customerId
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<string>('');
  const [saveCard, setSaveCard] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string>('');

  // Validate amount on mount
  useEffect(() => {
    const validation = PaymentService.validateAmount(amount);
    if (!validation.valid) {
      setError(validation.error || 'Invalid amount');
      return;
    }

    // Create payment intent when component mounts
    createPaymentIntent();
  }, [amount, currency, orderId]);

  const createPaymentIntent = async () => {
    try {
      setError('');
      
      const request: CreatePaymentIntentRequest = {
        amount,
        currency,
        orderId,
        metadata: {
          customerId: customerId || '',
          source: 'payment_form'
        }
      };

      const response = await PaymentService.createPaymentIntent(request);
      
      if (response.status === 'success') {
        setPaymentIntent(response.data.paymentIntent);
      } else {
        setError('Failed to initialize payment');
        onError?.('Failed to initialize payment');
      }
    } catch (err: any) {
      const errorMessage = PaymentService.getErrorMessage(err);
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : '');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !paymentIntent) {
      setError('Payment system not ready');
      return;
    }

    if (!cardComplete) {
      setError('Please complete your card information');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Process the payment
      const result = await PaymentService.processPayment(
        paymentIntent.client_secret,
        cardElement
      );

      if (result.success && result.paymentIntent) {
        // Save card if requested
        if (saveCard && customerId && result.paymentIntent.payment_method) {
          try {
            await PaymentService.savePaymentMethod(
              customerId,
              result.paymentIntent.payment_method as string
            );
          } catch (saveError) {
            console.warn('Failed to save payment method:', saveError);
            // Don't fail the payment if saving the card fails
          }
        }

        onSuccess?.(result.paymentIntent);
      } else {
        const errorMessage = PaymentService.getErrorMessage(result.error);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = PaymentService.getErrorMessage(err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: 'antialiased',
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="payment-form__header">
        <h3>Payment Information</h3>
        <div className="payment-form__amount">
          Total: {PaymentService.formatAmount(amount, currency)}
        </div>
      </div>

      <div className="payment-form__card">
        <label htmlFor="card-element" className="payment-form__label">
          Card Information
        </label>
        <div className="payment-form__card-element">
          <CardElement
            id="card-element"
            options={cardElementOptions}
            onChange={handleCardChange}
          />
        </div>
        {cardError && (
          <div className="payment-form__error payment-form__error--card">
            {cardError}
          </div>
        )}
      </div>

      {showSaveCard && customerId && (
        <div className="payment-form__save-card">
          <label className="payment-form__checkbox">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              disabled={isProcessing}
            />
            <span>Save this card for future payments</span>
          </label>
        </div>
      )}

      {error && (
        <div className="payment-form__error payment-form__error--general">
          {error}
        </div>
      )}

      <div className="payment-form__actions">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="payment-form__button payment-form__button--cancel"
            disabled={isProcessing}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="payment-form__button payment-form__button--submit"
          disabled={disabled || isProcessing || !cardComplete || !paymentIntent}
        >
          {isProcessing ? 'Processing...' : `Pay ${PaymentService.formatAmount(amount, currency)}`}
        </button>
      </div>

      {paymentIntent && (
        <div className="payment-form__status">
          <small>
            Payment Status: {PaymentService.getPaymentStatusText(paymentIntent.status)}
          </small>
        </div>
      )}
    </form>
  );
};

const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInternal {...props} />
    </Elements>
  );
};

export default PaymentForm;
