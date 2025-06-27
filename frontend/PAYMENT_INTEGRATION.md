# Stripe Payment Integration

This document describes the Stripe payment integration implemented in the frontend application.

## Overview

The payment system uses Stripe for secure payment processing, including:
- Payment intent creation
- Card payment processing
- Payment method management
- Refund processing
- Payment history tracking

## Components

### StripePaymentForm
A React component that provides a complete payment form with Stripe Elements integration.

**Features:**
- Secure card input using Stripe Elements
- Payment intent creation and processing
- Real-time validation and error handling
- Loading states and user feedback
- Responsive design with Tailwind CSS

**Usage:**
```tsx
import StripePaymentForm from './components/payment/StripePaymentForm';

<StripePaymentForm
  amount={2000} // Amount in cents ($20.00)
  currency="usd"
  orderId="order-123"
  onSuccess={(paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
  }}
  onError={(error) => {
    console.error('Payment failed:', error);
  }}
  onCancel={() => {
    console.log('Payment cancelled');
  }}
/>
```

### PaymentService
A service class that handles all payment-related API calls and Stripe interactions.

**Methods:**
- `createPaymentIntent(request)` - Create a new payment intent
- `confirmPayment(clientSecret, paymentMethodId)` - Confirm payment with payment method
- `processPayment(clientSecret, cardElement)` - Process payment with card element
- `getPaymentMethods(customerId)` - Get saved payment methods
- `savePaymentMethod(customerId, paymentMethodId)` - Save payment method
- `processRefund(paymentIntentId, amount?)` - Process refund
- `getPaymentHistory(customerId, limit?)` - Get payment history

## Configuration

### Environment Variables
Add the following to your `.env` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

### Backend Requirements
The backend must implement the following endpoints:

- `POST /api/payments/create-intent` - Create payment intent
- `GET /api/payments/payment-methods/:customerId` - Get payment methods
- `POST /api/payments/save-payment-method` - Save payment method
- `POST /api/payments/refund` - Process refund
- `GET /api/payments/history/:customerId` - Get payment history

## Testing

### Unit Tests
The payment system includes comprehensive unit tests:

- **StripePaymentForm.test.tsx** - Component testing with mocked Stripe
- **paymentService.test.ts** - Service layer testing with mocked API calls

### Test Coverage
- Payment form rendering and interactions
- Payment intent creation and processing
- Error handling and validation
- Loading states and user feedback
- API integration testing

### Running Tests
```bash
# Run all payment tests
npm test -- --testPathPattern=payment

# Run specific test files
npm test src/tests/components/StripePaymentForm.test.tsx
npm test src/tests/services/paymentService.test.ts
```

## Security Considerations

1. **PCI Compliance**: Stripe handles all sensitive card data, ensuring PCI compliance
2. **Environment Variables**: Store Stripe keys in environment variables, not in code
3. **Server-side Validation**: Always validate payments on the backend
4. **HTTPS**: Use HTTPS in production for secure communication
5. **Error Handling**: Don't expose sensitive error details to users

## Error Handling

The payment system handles various error scenarios:

- **Card Declined**: User-friendly error messages
- **Network Errors**: Retry mechanisms and fallback options
- **Validation Errors**: Real-time form validation
- **Stripe Errors**: Proper error mapping and display

## Integration with Order Management

The payment system integrates with the order management system by:

1. Creating payment intents linked to order IDs
2. Updating order status based on payment results
3. Storing payment references for order tracking
4. Handling refunds for cancelled orders

## Future Enhancements

Potential improvements for the payment system:

1. **Saved Payment Methods**: Allow users to save cards for future use
2. **Subscription Payments**: Support for recurring payments
3. **Multiple Payment Methods**: Support for wallets, bank transfers, etc.
4. **Payment Analytics**: Dashboard for payment metrics and insights
5. **Webhook Integration**: Real-time payment status updates

## Troubleshooting

### Common Issues

1. **Stripe not loading**: Check publishable key configuration
2. **Payment failing**: Verify backend endpoint implementation
3. **Test cards**: Use Stripe test cards for development
4. **CORS errors**: Ensure proper CORS configuration on backend

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed console logs for payment operations.
