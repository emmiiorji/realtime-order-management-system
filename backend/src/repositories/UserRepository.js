const BaseRepository = require('./BaseRepository');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    try {
      const user = await this.model.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });
      return user;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw this.handleError(error);
    }
  }

  async findByUsername(username) {
    try {
      const user = await this.model.findOne({ 
        username,
        isActive: true 
      });
      return user;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw this.handleError(error);
    }
  }

  async findByEmailOrUsername(emailOrUsername) {
    try {
      const user = await this.model.findOne({
        $or: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername }
        ],
        isActive: true
      });
      return user;
    } catch (error) {
      logger.error('Error finding user by email or username:', error);
      throw this.handleError(error);
    }
  }

  async findByCredentials(email, password) {
    try {
      const user = await User.findByCredentials(email, password);
      return user;
    } catch (error) {
      logger.error('Error finding user by credentials:', error);
      throw new AppError('Invalid credentials', 401);
    }
  }

  async createUser(userData) {
    try {
      // Check if user already exists
      const existingUser = await this.model.findOne({
        $or: [
          { email: userData.email.toLowerCase() },
          { username: userData.username }
        ]
      });

      if (existingUser) {
        throw new AppError('User with this email or username already exists', 400);
      }

      const user = await this.create(userData);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw this.handleError(error);
    }
  }

  async updateUser(id, updateData) {
    try {
      // If updating email or username, check for duplicates
      if (updateData.email || updateData.username) {
        const duplicateQuery = { id: { $ne: id } };
        
        if (updateData.email) {
          duplicateQuery.email = updateData.email.toLowerCase();
        }
        
        if (updateData.username) {
          duplicateQuery.username = updateData.username;
        }

        const existingUser = await this.model.findOne(duplicateQuery);
        
        if (existingUser) {
          throw new AppError('Email or username already in use', 400);
        }
      }

      const user = await this.updateById(id, updateData);
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw this.handleError(error);
    }
  }

  async deactivateUser(id) {
    try {
      const user = await this.updateById(id, { isActive: false });
      return user;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw this.handleError(error);
    }
  }

  async activateUser(id) {
    try {
      const user = await this.updateById(id, { isActive: true });
      return user;
    } catch (error) {
      logger.error('Error activating user:', error);
      throw this.handleError(error);
    }
  }

  async findActiveUsers(options = {}) {
    try {
      const filter = { isActive: true };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding active users:', error);
      throw this.handleError(error);
    }
  }

  async findUsersByRole(role, options = {}) {
    try {
      const filter = { role, isActive: true };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding users by role:', error);
      throw this.handleError(error);
    }
  }

  async searchUsers(searchTerm, options = {}) {
    try {
      const filter = {
        isActive: true,
        $or: [
          { username: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } }
        ]
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error searching users:', error);
      throw this.handleError(error);
    }
  }

  async getUserStats() {
    try {
      const stats = await User.getStats();
      return stats;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw this.handleError(error);
    }
  }

  async getUsersByDateRange(startDate, endDate, options = {}) {
    try {
      const filter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding users by date range:', error);
      throw this.handleError(error);
    }
  }

  async updateLastLogin(id) {
    try {
      const user = await this.updateById(id, { lastLogin: new Date() });
      return user;
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw this.handleError(error);
    }
  }

  async incrementLoginAttempts(id) {
    try {
      const user = await this.findById(id);
      if (user) {
        await user.incLoginAttempts();
      }
      return user;
    } catch (error) {
      logger.error('Error incrementing login attempts:', error);
      throw this.handleError(error);
    }
  }

  async resetLoginAttempts(id) {
    try {
      const user = await this.findById(id);
      if (user) {
        await user.resetLoginAttempts();
      }
      return user;
    } catch (error) {
      logger.error('Error resetting login attempts:', error);
      throw this.handleError(error);
    }
  }

  async findLockedUsers(options = {}) {
    try {
      const filter = {
        lockUntil: { $gt: new Date() }
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding locked users:', error);
      throw this.handleError(error);
    }
  }

  async unlockUser(id) {
    try {
      const user = await this.updateById(id, {
        $unset: {
          lockUntil: 1,
          loginAttempts: 1
        }
      });
      return user;
    } catch (error) {
      logger.error('Error unlocking user:', error);
      throw this.handleError(error);
    }
  }

  async updateUserPreferences(id, preferences) {
    try {
      const user = await this.updateById(id, {
        'profile.preferences': preferences
      });
      return user;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw this.handleError(error);
    }
  }

  async getUsersWithRecentActivity(days = 30, options = {}) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const filter = {
        isActive: true,
        lastLogin: { $gte: cutoffDate }
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding users with recent activity:', error);
      throw this.handleError(error);
    }
  }

  async getUsersWithoutRecentActivity(days = 30, options = {}) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const filter = {
        isActive: true,
        $or: [
          { lastLogin: { $lt: cutoffDate } },
          { lastLogin: { $exists: false } }
        ]
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding users without recent activity:', error);
      throw this.handleError(error);
    }
  }

  async bulkUpdateUsers(userIds, updateData) {
    try {
      const operations = userIds.map(id => ({
        updateOne: {
          filter: { id },
          update: updateData
        }
      }));

      const result = await this.bulkWrite(operations);
      return result;
    } catch (error) {
      logger.error('Error in bulk user update:', error);
      throw this.handleError(error);
    }
  }

  async getUserAnalytics(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
            verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
      ];

      const analytics = await this.aggregate(pipeline);
      return analytics;
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw this.handleError(error);
    }
  }
}

module.exports = UserRepository;
