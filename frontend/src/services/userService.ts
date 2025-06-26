import { api, ApiResponse, User, CreateUserRequest, LoginRequest, UpdateUserRequest } from './api';

export class UserService {
  // Authentication
  static async register(userData: CreateUserRequest): Promise<ApiResponse<{ user: User }>> {
    const response = await api.post<ApiResponse<{ user: User }>>('/users/register', userData);
    return response.data;
  }

  static async login(credentials: LoginRequest): Promise<ApiResponse<{ user: User; token?: string }>> {
    const response = await api.post<ApiResponse<{ user: User; token?: string }>>('/users/login', credentials);
    
    // Store user data in localStorage
    if (response.data.data.user) {
      localStorage.setItem('userId', response.data.data.user.id);
      if (response.data.data.token) {
        localStorage.setItem('authToken', response.data.data.token);
      }
    }
    
    return response.data;
  }

  static async logout(): Promise<void> {
    try {
      await api.post('/users/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
    }
  }

  // Profile management
  static async getProfile(): Promise<ApiResponse<{ user: User }>> {
    const response = await api.get<ApiResponse<{ user: User }>>('/users/profile');
    return response.data;
  }

  static async updateProfile(updateData: UpdateUserRequest): Promise<ApiResponse<{ user: User }>> {
    const response = await api.patch<ApiResponse<{ user: User }>>('/users/profile', updateData);
    return response.data;
  }

  static async changePassword(passwordData: { currentPassword: string; newPassword: string }): Promise<ApiResponse<any>> {
    const response = await api.patch<ApiResponse<any>>('/users/change-password', passwordData);
    return response.data;
  }

  static async deleteProfile(): Promise<ApiResponse<any>> {
    const response = await api.delete<ApiResponse<any>>('/users/profile');
    
    // Clear local storage after successful deletion
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    
    return response.data;
  }

  // Admin functions
  static async getAllUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<{ users: User[] }>> {
    const response = await api.get<ApiResponse<{ users: User[] }>>('/users', { params });
    return response.data;
  }

  static async getUser(userId: string): Promise<ApiResponse<{ user: User }>> {
    const response = await api.get<ApiResponse<{ user: User }>>(`/users/${userId}`);
    return response.data;
  }

  static async updateUser(userId: string, updateData: UpdateUserRequest): Promise<ApiResponse<{ user: User }>> {
    const response = await api.patch<ApiResponse<{ user: User }>>(`/users/${userId}`, updateData);
    return response.data;
  }

  static async deleteUser(userId: string): Promise<ApiResponse<any>> {
    const response = await api.delete<ApiResponse<any>>(`/users/${userId}`);
    return response.data;
  }

  static async getUserStats(): Promise<ApiResponse<{ stats: any }>> {
    const response = await api.get<ApiResponse<{ stats: any }>>('/users/stats');
    return response.data;
  }

  // Utility functions
  static getCurrentUserId(): string | null {
    return localStorage.getItem('userId');
  }

  static getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  static isAuthenticated(): boolean {
    return !!this.getAuthToken() && !!this.getCurrentUserId();
  }

  static async forgotPassword(email: string): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>('/users/forgot-password', { email });
    return response.data;
  }

  static async resetPassword(token: string, newPassword: string): Promise<ApiResponse<any>> {
    const response = await api.patch<ApiResponse<any>>(`/users/reset-password/${token}`, { password: newPassword });
    return response.data;
  }
}

export default UserService;
