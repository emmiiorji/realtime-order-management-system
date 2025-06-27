import React from 'react';
import { PaymentService } from '../services/paymentService';
import type { PaymentIntent } from '../services/paymentService';

interface PaymentStatusProps {
  paymentIntent: PaymentIntent;
  showDetails?: boolean;
  className?: string;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({
  paymentIntent,
  showDetails = false,
  className = ''
}) => {
  const statusText = PaymentService.getPaymentStatusText(paymentIntent.status);
  const statusColor = PaymentService.getPaymentStatusColor(paymentIntent.status);
  const formattedAmount = PaymentService.formatAmount(paymentIntent.amount, paymentIntent.currency);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <svg className="payment-status__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="payment-status__icon payment-status__icon--spinning" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        );
      case 'canceled':
      case 'requires_payment_method':
        return (
          <svg className="payment-status__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'requires_action':
        return (
          <svg className="payment-status__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="payment-status__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div 
      className={`payment-status ${className}`}
      style={{ '--status-color': statusColor } as React.CSSProperties}
    >
      <div className="payment-status__main">
        <div className="payment-status__icon-container">
          {getStatusIcon(paymentIntent.status)}
        </div>
        <div className="payment-status__content">
          <div className="payment-status__text">{statusText}</div>
          <div className="payment-status__amount">{formattedAmount}</div>
        </div>
      </div>

      {showDetails && (
        <div className="payment-status__details">
          <div className="payment-status__detail">
            <span className="payment-status__detail-label">Payment ID:</span>
            <span className="payment-status__detail-value">{paymentIntent.id}</span>
          </div>
          <div className="payment-status__detail">
            <span className="payment-status__detail-label">Currency:</span>
            <span className="payment-status__detail-value">{paymentIntent.currency.toUpperCase()}</span>
          </div>
          <div className="payment-status__detail">
            <span className="payment-status__detail-label">Status:</span>
            <span className="payment-status__detail-value">{paymentIntent.status}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentStatus;
