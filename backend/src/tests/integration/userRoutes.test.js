const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/userRoutes');
const UserService = require('../../services/userService');
const eventBus = require('../../events/eventBus');

// Mock dependencies
jest.mock('../../services/userService');
jest.mock('../../events/eventBus');
jest.mock('../../config/logger');

describe('User Routes Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock eventBus
    eventBus.publish = jest.fn().mockResolvedValue();
  });

  describe('POST /api/users/register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user123',
        ...validUserData,
        password: undefined, // Password should be removed from response
        role: 'user',
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      UserService.register = jest.fn().mockResolvedValue({
        status: 'success',
        data: { user: mockUser },
      });

      const response = await request(app)
        .post('/api/users/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: expect.objectContaining({
            id: 'user123',
            username: 'testuser',
            email: 'test@example.com',
          }),
        },
      });

      expect(UserService.register).toHaveBeenCalledWith(validUserData);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser',
        }),
        expect.any(Object)
      );
    });

    it('should return 400 for invalid user data', async () => {
      const invalidUserData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123', // Too short
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Username must be at least 3 characters');
    });

    it('should return 400 if user already exists', async () => {
      UserService.register = jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'User with this email or username already exists' },
        },
      });

      const response = await request(app)
        .post('/api/users/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle missing required fields', async () => {
      const incompleteData = {
        username: 'testuser',
        // Missing email and password
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Email is required');
    });
  });

  describe('POST /api/users/login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        lastLogin: new Date().toISOString(),
      };

      UserService.login = jest.fn().mockResolvedValue({
        status: 'success',
        data: { user: mockUser },
      });

      const response = await request(app)
        .post('/api/users/login')
        .send(validCredentials)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Login successful',
        data: {
          user: expect.objectContaining({
            id: 'user123',
            email: 'test@example.com',
          }),
        },
      });

      expect(UserService.login).toHaveBeenCalledWith(validCredentials);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'user.login',
        expect.objectContaining({
          userId: 'user123',
          email: 'test@example.com',
        }),
        expect.any(Object)
      );
    });

    it('should return 401 for invalid credentials', async () => {
      UserService.login = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          // Missing password
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Please provide email and password');
    });

    it('should handle invalid email format', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
      };

      UserService.getProfile = jest.fn().mockResolvedValue({
        status: 'success',
        data: { user: mockUser },
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('x-user-id', 'user123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          user: expect.objectContaining({
            id: 'user123',
            email: 'test@example.com',
          }),
        },
      });

      expect(UserService.getProfile).toHaveBeenCalled();
    });

    it('should return 401 when user not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('User not authenticated');
    });

    it('should return 404 when user not found', async () => {
      UserService.getProfile = jest.fn().mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'User not found' },
        },
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('x-user-id', 'nonexistent')
        .expect(404);

      expect(response.body.status).toBe('error');
    });
  });

  describe('PATCH /api/users/profile', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
      profile: {
        bio: 'Updated bio',
      },
    };

    it('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        profile: {
          bio: 'Updated bio',
        },
      };

      UserService.updateProfile = jest.fn().mockResolvedValue({
        status: 'success',
        data: { user: mockUpdatedUser },
      });

      const response = await request(app)
        .patch('/api/users/profile')
        .set('x-user-id', 'user123')
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Profile updated successfully',
        data: {
          user: expect.objectContaining({
            firstName: 'Updated',
            lastName: 'Name',
          }),
        },
      });

      expect(UserService.updateProfile).toHaveBeenCalledWith(updateData);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'user.updated',
        expect.objectContaining({
          userId: 'user123',
          updatedFields: ['firstName', 'lastName', 'profile'],
        }),
        expect.any(Object)
      );
    });

    it('should reject password updates through profile route', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('x-user-id', 'user123')
        .send({
          firstName: 'Updated',
          password: 'newpassword',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not for password updates');
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('x-user-id', 'user123')
        .send({
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('PATCH /api/users/change-password', () => {
    const passwordData = {
      currentPassword: 'oldpassword',
      newPassword: 'NewPassword123',
    };

    it('should change password successfully', async () => {
      UserService.changePassword = jest.fn().mockResolvedValue({
        status: 'success',
        message: 'Password changed successfully',
      });

      const response = await request(app)
        .patch('/api/users/change-password')
        .set('x-user-id', 'user123')
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Password changed successfully',
      });

      expect(UserService.changePassword).toHaveBeenCalledWith(passwordData);
    });

    it('should return 400 for missing password data', async () => {
      const response = await request(app)
        .patch('/api/users/change-password')
        .set('x-user-id', 'user123')
        .send({
          currentPassword: 'oldpassword',
          // Missing newPassword
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Please provide current and new password');
    });

    it('should return 400 for incorrect current password', async () => {
      UserService.changePassword = jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Current password is incorrect' },
        },
      });

      const response = await request(app)
        .patch('/api/users/change-password')
        .set('x-user-id', 'user123')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPassword123',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('DELETE /api/users/profile', () => {
    it('should delete user profile successfully', async () => {
      UserService.deleteProfile = jest.fn().mockResolvedValue({
        status: 'success',
        message: 'Account deleted successfully',
      });

      const response = await request(app)
        .delete('/api/users/profile')
        .set('x-user-id', 'user123')
        .expect(204);

      expect(UserService.deleteProfile).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        'user.deleted',
        expect.objectContaining({
          userId: 'user123',
          reason: 'User requested account deletion',
        }),
        expect.any(Object)
      );
    });

    it('should return 401 when user not authenticated', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('User not authenticated');
    });
  });

  describe('GET /api/users (Admin)', () => {
    it('should get all users with pagination', async () => {
      const mockUsers = [
        { id: 'user1', username: 'user1', email: 'user1@example.com' },
        { id: 'user2', username: 'user2', email: 'user2@example.com' },
      ];

      UserService.getAllUsers = jest.fn().mockResolvedValue({
        status: 'success',
        results: 2,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1,
        },
        data: { users: mockUsers },
      });

      const response = await request(app)
        .get('/api/users')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        results: 2,
        pagination: expect.objectContaining({
          page: 1,
          limit: 10,
        }),
        data: {
          users: expect.arrayContaining([
            expect.objectContaining({ id: 'user1' }),
            expect.objectContaining({ id: 'user2' }),
          ]),
        },
      });

      expect(UserService.getAllUsers).toHaveBeenCalledWith({
        page: '1',
        limit: '10',
      });
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({ role: 'admin' })
        .expect(200);

      expect(UserService.getAllUsers).toHaveBeenCalledWith({
        role: 'admin',
      });
    });

    it('should filter users by active status', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({ isActive: 'true' })
        .expect(200);

      expect(UserService.getAllUsers).toHaveBeenCalledWith({
        isActive: 'true',
      });
    });
  });

  describe('GET /api/users/stats (Admin)', () => {
    it('should get user statistics', async () => {
      const mockStats = {
        totalUsers: 100,
        activeUsers: 90,
        verifiedUsers: 80,
        adminUsers: 5,
      };

      UserService.getUserStats = jest.fn().mockResolvedValue({
        status: 'success',
        data: { stats: mockStats },
      });

      const response = await request(app)
        .get('/api/users/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          stats: mockStats,
        },
      });

      expect(UserService.getUserStats).toHaveBeenCalled();
    });
  });
});
