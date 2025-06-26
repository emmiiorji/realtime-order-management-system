import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add correlation ID for tracing
    config.headers['x-correlation-id'] = generateCorrelationId();

    // Add user ID if available
    const userId = localStorage.getItem('userId');
    if (userId) {
      config.headers['x-user-id'] = userId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to generate correlation ID
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generic API methods
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.get(url, config),
  
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.post(url, data, config),
  
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.put(url, data, config),
  
  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.patch(url, data, config),
  
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.delete(url, config),
};

// API Response types
export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  status: string;
  message: string;
  errors?: string[];
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: string;
  profile?: {
    avatar?: string;
    bio?: string;
    dateOfBirth?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    preferences?: {
      notifications?: {
        email: boolean;
        sms: boolean;
        push: boolean;
      };
      theme: 'light' | 'dark' | 'auto';
      language: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profile?: Partial<User['profile']>;
}

// Order types
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
  category?: string;
  attributes?: {
    size?: string;
    color?: string;
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
  };
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  instructions?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: {
    cost: number;
    method: 'standard' | 'express' | 'overnight' | 'pickup';
    estimatedDelivery?: string;
    trackingNumber?: string;
    carrier?: string;
  };
  discount: {
    amount: number;
    code?: string;
    type?: 'percentage' | 'fixed' | 'free_shipping';
  };
  totalAmount: number;
  currency: string;
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  payment: {
    method: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'cash_on_delivery';
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
    transactionId?: string;
    amount: number;
    currency: string;
    processedAt?: string;
    failureReason?: string;
  };
  notes?: string;
  customerNotes?: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    updatedBy?: string;
    reason?: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  items: Omit<OrderItem, 'totalPrice'>[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  payment: {
    method: Order['payment']['method'];
    amount: number;
    currency?: string;
  };
  shipping?: {
    method?: Order['shipping']['method'];
    cost?: number;
  };
  discount?: {
    code?: string;
    amount?: number;
    type?: Order['discount']['type'];
  };
  notes?: string;
  customerNotes?: string;
}

// Event types
export interface Event {
  id: string;
  type: string;
  data: any;
  metadata: {
    timestamp: string;
    source: string;
    version: string;
    correlationId?: string;
    causationId?: string;
    userId?: string;
  };
  processed: boolean;
  createdAt: string;
  priority?: string | number;
}

export default api;
