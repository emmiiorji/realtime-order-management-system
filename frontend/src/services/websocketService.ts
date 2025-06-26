import { io, Socket } from 'socket.io-client';
import type { Event } from './api';

export type EventCallback = (event: Event) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: unknown) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private eventCallbacks: Map<string, EventCallback[]> = new Map();
  private connectionCallbacks: ConnectionCallback[] = [];
  private disconnectionCallbacks: ConnectionCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect(): void {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
    
    this.socket = io(wsUrl, {
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join user-specific room if authenticated
      const userId = localStorage.getItem('userId');
      if (userId) {
        this.socket?.emit('join-room', `user-${userId}`);
      }

      this.connectionCallbacks.forEach(callback => callback());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.disconnectionCallbacks.forEach(callback => callback());
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.errorCallbacks.forEach(callback => callback(error));
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      this.errorCallbacks.forEach(callback => callback(error));
    });

    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      this.errorCallbacks.forEach(callback => 
        callback(new Error('Failed to reconnect to WebSocket'))
      );
    });

    // Listen for real-time events
    this.socket.on('event', (eventData: { type: string; data: Event }) => {
      console.log('Received real-time event:', eventData);
      this.handleEvent(eventData.type, eventData.data);
    });

    // Listen for specific event types
    this.socket.on('user.created', (event: Event) => this.handleEvent('user.created', event));
    this.socket.on('user.updated', (event: Event) => this.handleEvent('user.updated', event));
    this.socket.on('user.deleted', (event: Event) => this.handleEvent('user.deleted', event));
    this.socket.on('order.created', (event: Event) => this.handleEvent('order.created', event));
    this.socket.on('order.updated', (event: Event) => this.handleEvent('order.updated', event));
    this.socket.on('order.cancelled', (event: Event) => this.handleEvent('order.cancelled', event));
    this.socket.on('order.completed', (event: Event) => this.handleEvent('order.completed', event));
    this.socket.on('order.shipped', (event: Event) => this.handleEvent('order.shipped', event));
  }

  private handleEvent(eventType: string, event: Event): void {
    // Call specific event type callbacks
    const typeCallbacks = this.eventCallbacks.get(eventType) || [];
    typeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in event callback for ${eventType}:`, error);
      }
    });

    // Call general event callbacks
    const generalCallbacks = this.eventCallbacks.get('*') || [];
    generalCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in general event callback:', error);
      }
    });
  }

  // Public methods
  public subscribe(eventType: string, callback: EventCallback): () => void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    
    this.eventCallbacks.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  public subscribeToAll(callback: EventCallback): () => void {
    return this.subscribe('*', callback);
  }

  public onConnect(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    
    // If already connected, call immediately
    if (this.isConnected) {
      callback();
    }

    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  public onDisconnect(callback: ConnectionCallback): () => void {
    this.disconnectionCallbacks.push(callback);

    return () => {
      const index = this.disconnectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.disconnectionCallbacks.splice(index, 1);
      }
    };
  }

  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);

    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  public joinRoom(room: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', room);
    }
  }

  public leaveRoom(room: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-room', room);
    }
  }

  public emit(eventName: string, data: unknown): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(eventName, data);
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  public reconnect(): void {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  public getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }

  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
