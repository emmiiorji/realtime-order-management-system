import { api } from './api';
import type { ApiResponse, Event } from './api';

export class EventService {
  // Event monitoring
  static async getEventSystemHealth(): Promise<ApiResponse<{ health: Record<string, unknown> }>> {
    const response = await api.get<ApiResponse<{ health: Record<string, unknown> }>>('/events/health');
    return response.data;
  }

  static async getEventStats(): Promise<ApiResponse<{ stats: Record<string, unknown> }>> {
    const response = await api.get<ApiResponse<{ stats: Record<string, unknown> }>>('/events/stats');
    return response.data;
  }

  static async getSubscribers(): Promise<ApiResponse<{ subscribers: unknown[] }>> {
    const response = await api.get<ApiResponse<{ subscribers: unknown[] }>>('/events/subscribers');
    return response.data;
  }

  // Event querying
  static async getAllEvents(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ events: Event[] }>> {
    const response = await api.get<ApiResponse<{ events: Event[] }>>('/events', { params });
    return response.data;
  }

  static async getEventsByType(eventType: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ events: Event[]; eventType: string }>> {
    const response = await api.get<ApiResponse<{ events: Event[]; eventType: string }>>(`/events/types/${eventType}`, { params });
    return response.data;
  }

  static async getEventsByCorrelation(correlationId: string): Promise<ApiResponse<{ events: Event[]; correlationId: string }>> {
    const response = await api.get<ApiResponse<{ events: Event[]; correlationId: string }>>(`/events/correlation/${correlationId}`);
    return response.data;
  }

  static async getEventsByDateRange(params: {
    startDate: string;
    endDate: string;
    eventType?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ events: Event[]; dateRange: Record<string, unknown> }>> {
    const response = await api.get<ApiResponse<{ events: Event[]; dateRange: Record<string, unknown> }>>('/events/date-range', { params });
    return response.data;
  }

  static async getEvent(eventId: string): Promise<ApiResponse<{ event: Event }>> {
    const response = await api.get<ApiResponse<{ event: Event }>>(`/events/${eventId}`);
    return response.data;
  }

  // Event publishing (for testing)
  static async publishEvent(eventData: {
    eventType: string;
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<{ event: Event }>> {
    const response = await api.post<ApiResponse<{ event: Event }>>('/events/publish', eventData);
    return response.data;
  }

  // Event replay (admin only)
  static async replayEvent(eventId: string): Promise<ApiResponse<{ originalEvent: Event; replayedEvent: Event }>> {
    const response = await api.post<ApiResponse<{ originalEvent: Event; replayedEvent: Event }>>(`/events/${eventId}/replay`);
    return response.data;
  }

  // Utility functions
  static formatEventType(eventType: string): string {
    return eventType
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  static getEventTypeColor(eventType: string): string {
    if (eventType.startsWith('user.')) return '#3b82f6';
    if (eventType.startsWith('order.')) return '#10b981';
    if (eventType.startsWith('system.')) return '#f59e0b';
    if (eventType.startsWith('notification.')) return '#8b5cf6';
    if (eventType.startsWith('inventory.')) return '#06b6d4';
    return '#6b7280';
  }

  static formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  static getEventPriority(event: Event): 'low' | 'normal' | 'high' | 'critical' {
    const priority = event.priority;
    if (priority && ['low', 'normal', 'high', 'critical'].includes(String(priority))) {
      return String(priority) as 'low' | 'normal' | 'high' | 'critical';
    }
    // Determine priority based on event type
    if (event.type.includes('error') || event.type.includes('failed')) {
      return 'high';
    }
    if (event.type.includes('created') || event.type.includes('completed')) {
      return 'normal';
    }
    return 'low';
  }

  static getPriorityColor(priority: 'low' | 'normal' | 'high' | 'critical'): string {
    const colors = {
      low: '#10b981',
      normal: '#3b82f6',
      high: '#f59e0b',
      critical: '#ef4444'
    };
    return colors[priority];
  }
}

export default EventService;
