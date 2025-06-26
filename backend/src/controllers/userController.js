const User = require('../models/User');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { eventBus } = require('../events/eventBus');
const { USER_EVENTS } = require('../events/eventTypes');
const logger = require('../config/logger');

// Helper function to filter user data
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// Helper to filter user response fields
function filterUserResponse(user) {
  if (!user) return user;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    lastLogin: user.lastLogin,
    profile: user.profile,
    metadata: user.metadata,
    // Add/remove fields as needed to match test expectations
  };
}

// Register a new user
exports.register = catchAsync(async (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;

  // Check for missing required fields
  if (!username || !email || !password) {
    return next(new AppError('Username, email, and password are required', 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return next(new AppError('User with this email or username already exists', 400));
  }

  // Create new user
  const newUser = await User.create({
    username,
    email,
    password,
    firstName,
    lastName
  });

  // Remove password from output
  newUser.password = undefined;

  // Publish user created event
  await eventBus.publish(USER_EVENTS.USER_CREATED, {
    userId: newUser.id,
    email: newUser.email,
    username: newUser.username,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    role: newUser.role
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: newUser.id
  });

  logger.info(`New user registered: ${newUser.email}`, { userId: newUser.id });

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully',
    data: {
      user: filterUserResponse(newUser)
    }
  });
});

// Login user
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  try {
    // Find user and check password
    const user = await User.findByCredentials(email, password);

    // Publish user login event
    await eventBus.publish(USER_EVENTS.USER_LOGIN, {
      userId: user.id,
      email: user.email,
      loginTime: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }, {
      correlationId: req.headers['x-correlation-id'],
      userId: user.id
    });

    logger.info(`User logged in: ${user.email}`, { userId: user.id });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: filterUserResponse(user)
      }
    });
  } catch (error) {
    logger.warn(`Failed login attempt for email: ${email}`, { 
      email, 
      ip: req.ip,
      error: error.message 
    });
    return next(new AppError('Invalid credentials', 401));
  }
});

// Get current user profile
exports.getProfile = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  const user = await User.findOne({ id: userId });
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: filterUserResponse(user)
    }
  });
});

// Update current user profile
exports.updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  // Filter out unwanted fields
  const filteredBody = filterObj(req.body, 'firstName', 'lastName', 'email', 'profile');

  // Don't allow password updates through this route
  if (req.body.password) {
    return next(new AppError('This route is not for password updates. Please use /change-password', 400));
  }

  const updatedUser = await User.findOneAndUpdate(
    { id: userId },
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  );

  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }

  // Publish user updated event
  await eventBus.publish(USER_EVENTS.USER_UPDATED, {
    userId: updatedUser.id,
    updatedFields: Object.keys(filteredBody),
    ...filteredBody
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: updatedUser.id
  });

  logger.info(`User profile updated: ${updatedUser.email}`, { userId: updatedUser.id });

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: filterUserResponse(updatedUser)
    }
  });
});

// Change password
exports.changePassword = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }

  // Get user with password
  const user = await User.findOne({ id: userId }).select('+password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if current password is correct
  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError('Current password is incorrect', 400));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.email}`, { userId: user.id });

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
});

// Delete current user profile
exports.deleteProfile = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  const user = await User.findOneAndUpdate(
    { id: userId },
    { isActive: false },
    { new: true }
  );

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Publish user deleted event
  await eventBus.publish(USER_EVENTS.USER_DELETED, {
    userId: user.id,
    email: user.email,
    reason: 'User requested account deletion'
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: user.id
  });

  logger.info(`User account deactivated: ${user.email}`, { userId: user.id });

  res.status(204).json({
    status: 'success',
    message: 'Account deleted successfully'
  });
});

// Admin: Get all users
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const users = await User.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      users: users.map(filterUserResponse)
    }
  });
});

// Admin: Get user by ID
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ id: req.params.id });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: filterUserResponse(user)
    }
  });
});

// Admin: Update user
exports.updateUser = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findOneAndUpdate(
    { id: req.params.id },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }

  // Publish user updated event
  await eventBus.publish(USER_EVENTS.USER_UPDATED, {
    userId: updatedUser.id,
    updatedFields: Object.keys(req.body),
    updatedBy: req.headers['x-user-id'] || 'admin',
    ...req.body
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: req.headers['x-user-id']
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: filterUserResponse(updatedUser)
    }
  });
});

// Admin: Delete user
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findOneAndDelete({ id: req.params.id });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Publish user deleted event
  await eventBus.publish(USER_EVENTS.USER_DELETED, {
    userId: user.id,
    email: user.email,
    deletedBy: req.headers['x-user-id'] || 'admin',
    reason: 'Admin deletion'
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: req.headers['x-user-id']
  });

  res.status(204).json({
    status: 'success',
    message: 'User deleted successfully'
  });
});

// Get user statistics
exports.getUserStats = catchAsync(async (req, res, next) => {
  const stats = await User.getStats();

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

// Forgot password (placeholder)
exports.forgotPassword = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    message: 'Password reset functionality not implemented yet'
  });
});

// Reset password (placeholder)
exports.resetPassword = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    message: 'Password reset functionality not implemented yet'
  });
});
