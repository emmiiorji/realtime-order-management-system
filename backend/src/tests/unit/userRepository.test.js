const UserRepository = require('../../repositories/UserRepository');
const User = require('../../models/User');
const AppError = require('../../utils/appError');

// Mock the User model
jest.mock('../../models/User');
jest.mock('../../config/logger');

describe('UserRepository', () => {
  let userRepository;
  let mockUser;

  beforeEach(() => {
    userRepository = new UserRepository();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock user data
    mockUser = {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      save: jest.fn().mockResolvedValue(),
      incLoginAttempts: jest.fn().mockResolvedValue(),
      resetLoginAttempts: jest.fn().mockResolvedValue(),
    };
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(User.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        isActive: true,
      });
      expect(result).toEqual(mockUser);
    });

    it('should handle email case insensitivity', async () => {
      User.findOne.mockResolvedValue(mockUser);

      await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(User.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        isActive: true,
      });
    });

    it('should return null when user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      User.findOne.mockRejectedValue(error);

      await expect(
        userRepository.findByEmail('test@example.com')
      ).rejects.toThrow();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username successfully', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByUsername('testuser');

      expect(User.findOne).toHaveBeenCalledWith({
        username: 'testuser',
        isActive: true,
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await userRepository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrUsername', () => {
    it('should find user by email or username', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmailOrUsername('test@example.com');

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { email: 'test@example.com' },
          { username: 'test@example.com' },
        ],
        isActive: true,
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByCredentials', () => {
    it('should find user by valid credentials', async () => {
      User.findByCredentials = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.findByCredentials('test@example.com', 'password123');

      expect(User.findByCredentials).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual(mockUser);
    });

    it('should throw AppError for invalid credentials', async () => {
      const error = new Error('Invalid credentials');
      User.findByCredentials = jest.fn().mockRejectedValue(error);

      await expect(
        userRepository.findByCredentials('test@example.com', 'wrongpassword')
      ).rejects.toThrow(AppError);
    });
  });

  describe('createUser', () => {
    const userData = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should create user successfully', async () => {
      User.findOne.mockResolvedValue(null); // No existing user
      userRepository.create = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.createUser(userData);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { email: userData.email.toLowerCase() },
          { username: userData.username },
        ],
      });
      expect(userRepository.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user already exists', async () => {
      User.findOne.mockResolvedValue(mockUser); // Existing user
      userRepository.create = jest.fn();
      await expect(
        userRepository.createUser(userData)
      ).rejects.toThrow(AppError);
      
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user successfully', async () => {
      User.findOne.mockResolvedValue(null); // No duplicate
      userRepository.updateById = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.updateUser('user123', updateData);

      expect(userRepository.updateById).toHaveBeenCalledWith('user123', updateData);
      expect(result).toEqual(mockUser);
    });

    it('should check for duplicates when updating email', async () => {
      const updateDataWithEmail = {
        ...updateData,
        email: 'newemail@example.com',
      };

      User.findOne.mockResolvedValue(null); // No duplicate
      userRepository.updateById = jest.fn().mockResolvedValue(mockUser);

      await userRepository.updateUser('user123', updateDataWithEmail);

      expect(User.findOne).toHaveBeenCalledWith({
        id: { $ne: 'user123' },
        email: 'newemail@example.com',
      });
    });

    it('should throw error if email already in use', async () => {
      const updateDataWithEmail = {
        email: 'existing@example.com',
      };

      User.findOne.mockResolvedValue(mockUser); // Duplicate found

      await expect(
        userRepository.updateUser('user123', updateDataWithEmail)
      ).rejects.toThrow(AppError);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      userRepository.updateById = jest.fn().mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await userRepository.deactivateUser('user123');

      expect(userRepository.updateById).toHaveBeenCalledWith('user123', { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      userRepository.updateById = jest.fn().mockResolvedValue({
        ...mockUser,
        isActive: true,
      });

      const result = await userRepository.activateUser('user123');

      expect(userRepository.updateById).toHaveBeenCalledWith('user123', { isActive: true });
      expect(result.isActive).toBe(true);
    });
  });

  describe('findActiveUsers', () => {
    it('should find active users with pagination', async () => {
      const mockUsers = [mockUser];
      const mockResult = {
        data: mockUsers,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };

      userRepository.findMany = jest.fn().mockResolvedValue(mockResult);

      const result = await userRepository.findActiveUsers({ page: 1, limit: 10 });

      expect(userRepository.findMany).toHaveBeenCalledWith(
        { isActive: true },
        { page: 1, limit: 10 }
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findUsersByRole', () => {
    it('should find users by role', async () => {
      const mockResult = {
        data: [mockUser],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      };

      userRepository.findMany = jest.fn().mockResolvedValue(mockResult);

      const result = await userRepository.findUsersByRole('admin');

      expect(userRepository.findMany).toHaveBeenCalledWith(
        { role: 'admin', isActive: true },
        {}
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('searchUsers', () => {
    it('should search users by term', async () => {
      const searchTerm = 'john';
      const mockResult = {
        data: [mockUser],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      };

      userRepository.findMany = jest.fn().mockResolvedValue(mockResult);

      const result = await userRepository.searchUsers(searchTerm);

      expect(userRepository.findMany).toHaveBeenCalledWith(
        {
          isActive: true,
          $or: [
            { username: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } },
          ],
        },
        {}
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserStats', () => {
    it('should get user statistics', async () => {
      const mockStats = {
        totalUsers: 100,
        activeUsers: 90,
        verifiedUsers: 80,
        adminUsers: 5,
      };

      User.getStats = jest.fn().mockResolvedValue(mockStats);

      const result = await userRepository.getUserStats();

      expect(User.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const updatedUser = {
        ...mockUser,
        lastLogin: new Date(),
      };

      userRepository.updateById = jest.fn().mockResolvedValue(updatedUser);

      const result = await userRepository.updateLastLogin('user123');

      expect(userRepository.updateById).toHaveBeenCalledWith('user123', {
        lastLogin: expect.any(Date),
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('incrementLoginAttempts', () => {
    it('should increment login attempts', async () => {
      userRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.incrementLoginAttempts('user123');

      expect(userRepository.findById).toHaveBeenCalledWith('user123');
      expect(mockUser.incLoginAttempts).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      userRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await userRepository.incrementLoginAttempts('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resetLoginAttempts', () => {
    it('should reset login attempts', async () => {
      userRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.resetLoginAttempts('user123');

      expect(userRepository.findById).toHaveBeenCalledWith('user123');
      expect(mockUser.resetLoginAttempts).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUsersWithRecentActivity', () => {
    it('should find users with recent activity', async () => {
      const days = 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const mockResult = {
        data: [mockUser],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      };

      userRepository.findMany = jest.fn().mockResolvedValue(mockResult);

      const result = await userRepository.getUsersWithRecentActivity(days);

      expect(userRepository.findMany).toHaveBeenCalledWith(
        {
          isActive: true,
          lastLogin: { $gte: expect.any(Date) },
        },
        {}
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('bulkUpdateUsers', () => {
    it('should perform bulk update', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const updateData = { isActive: false };
      const mockResult = {
        matchedCount: 3,
        modifiedCount: 3,
      };

      userRepository.bulkWrite = jest.fn().mockResolvedValue(mockResult);

      const result = await userRepository.bulkUpdateUsers(userIds, updateData);

      expect(userRepository.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: { id: 'user1' }, update: updateData } },
        { updateOne: { filter: { id: 'user2' }, update: updateData } },
        { updateOne: { filter: { id: 'user3' }, update: updateData } },
      ]);
      expect(result).toEqual(mockResult);
    });
  });
});
