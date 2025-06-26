const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/userRoutes');

// Mock User model methods for integration tests
const User = require('../../models/User');
jest.mock('../../models/User', () => {
  return {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    findByCredentials: jest.fn(),
    getStats: jest.fn(),
    aggregate: jest.fn(),
  };
});

// Mock event bus
jest.mock('../../events/eventBus', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(),
  },
}));

// Mock logger
jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('User Routes Integration Tests', () => {
  let app;
  let mockUser;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);

    // Simple error handler for tests
    app.use((err, req, res, next) => {
      console.error('Test error:', err.message);
      res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message
      });
    });

    // Mock user data
    mockUser = {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      password: undefined, // Password should be undefined in responses
      correctPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(),
    };

    // Reset User model mocks
    jest.clearAllMocks();
  });

  describe('POST /api/users/register', () => {
    const validUserData = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'Password123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      // Mock User.findOne to return null (no existing user)
      User.findOne.mockResolvedValue(null);

      // Mock User.create to return a new user
      const newUser = {
        id: 'newuser123',
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'user',
        isActive: true,
        password: undefined, // Password should be undefined in response
      };
      User.create.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/api/users/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: expect.objectContaining({
            username: 'newuser',
            email: 'newuser@example.com',
          }),
        },
      });

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'newuser@example.com' }, { username: 'newuser' }]
      });
      expect(User.create).toHaveBeenCalledWith(validUserData);
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
      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('User with this email or username already exists');
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
      // Mock findByCredentials to return the seeded user
      User.findByCredentials.mockResolvedValue({
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        correctPassword: jest.fn().mockResolvedValue(true),
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
            email: 'test@example.com',
          }),
        },
      });

      expect(User.findByCredentials).toHaveBeenCalledWith('test@example.com', 'Password123');
    });

    it('should return 401 for invalid credentials', async () => {
      // Mock findByCredentials to throw an error
      User.findByCredentials.mockRejectedValue(new Error('Invalid credentials'));

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
      // Mock findByCredentials to throw an error for invalid email
      User.findByCredentials.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile successfully', async () => {
      // Mock User.findOne to return the user
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/profile')
        .set('x-user-id', 'user123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          user: expect.objectContaining({
            username: 'testuser',
            email: 'test@example.com',
          }),
        },
      });

      expect(User.findOne).toHaveBeenCalledWith({ id: 'user123' });
    });

    it('should return 401 when user not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('User not authenticated');
    });

    it('should return 404 when user not found', async () => {
      // Mock User.findOne to return null
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/profile')
        .set('x-user-id', 'nonexistent')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('User not found');
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
      // Mock User.findOneAndUpdate to return updated user
      const updatedUser = {
        ...mockUser,
        firstName: 'Updated',
        lastName: 'Name',
        profile: { bio: 'Updated bio' },
      };
      User.findOneAndUpdate.mockResolvedValue(updatedUser);

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

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'user123' },
        { firstName: 'Updated', lastName: 'Name', profile: { bio: 'Updated bio' } },
        { new: true, runValidators: true }
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
      currentPassword: 'Password123',
      newPassword: 'NewPassword123',
    };

    it('should change password successfully', async () => {
      // Mock User.findOne to return user with password
      const userWithPassword = {
        ...mockUser,
        password: 'hashedPassword123',
        correctPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(),
      };

      // Mock the chained select method
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword)
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

      expect(User.findOne).toHaveBeenCalledWith({ id: 'user123' });
      expect(userWithPassword.correctPassword).toHaveBeenCalledWith('Password123', 'hashedPassword123');
      expect(userWithPassword.save).toHaveBeenCalled();
    });

    it('should return 400 for missing password data', async () => {
      const response = await request(app)
        .patch('/api/users/change-password')
        .set('x-user-id', 'user123')
        .send({
          currentPassword: 'Password123',
          // Missing newPassword
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Please provide current and new password');
    });

    it('should return 400 for incorrect current password', async () => {
      // Mock User.findOne to return user with password
      const userWithPassword = {
        ...mockUser,
        password: 'hashedPassword123',
        correctPassword: jest.fn().mockResolvedValue(false), // Wrong password
      };

      // Mock the chained select method
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword)
      });

      const response = await request(app)
        .patch('/api/users/change-password')
        .set('x-user-id', 'user123')
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Current password is incorrect');
    });
  });

  describe('DELETE /api/users/profile', () => {
    it('should delete user profile successfully', async () => {
      // Mock User.findOneAndUpdate to return the user (for soft delete)
      User.findOneAndUpdate.mockResolvedValue(mockUser);

      const response = await request(app)
        .delete('/api/users/profile')
        .set('x-user-id', 'user123')
        .expect(204);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'user123' },
        { isActive: false },
        { new: true }
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
      // Mock User.find and User.countDocuments
      User.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([mockUser]),
      });
      User.countDocuments.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        results: 1,
        pagination: expect.objectContaining({
          limit: 10,
          page: 1,
        }),
        data: {
          users: expect.arrayContaining([
            expect.objectContaining({
              username: 'testuser',
              email: 'test@example.com',
            }),
          ]),
        },
      });
    });

    it('should filter users by role', async () => {
      User.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });
      User.countDocuments.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/users')
        .query({ role: 'admin' })
        .expect(200);

      expect(User.find).toHaveBeenCalledWith({ role: 'admin' });
    });

    it('should filter users by active status', async () => {
      User.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });
      User.countDocuments.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/users')
        .query({ isActive: 'true' })
        .expect(200);

      expect(User.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('GET /api/users/stats (Admin)', () => {
    it('should get user statistics', async () => {
      // Mock User.getStats method
      User.getStats.mockResolvedValue({
        totalUsers: 10,
        activeUsers: 8,
        verifiedUsers: 6,
        adminUsers: 2,
      });

      const response = await request(app)
        .get('/api/users/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          stats: expect.objectContaining({
            totalUsers: 10,
            activeUsers: 8,
            verifiedUsers: 6,
            adminUsers: 2,
          }),
        },
      });

      expect(User.getStats).toHaveBeenCalled();
    });
  });
});
