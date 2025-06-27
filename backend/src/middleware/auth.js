const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const securityConfig = require('../config/security');
const UserRepository = require('../repositories/UserRepository');

const userRepository = new UserRepository();

// Protect routes - require authentication
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2) Verification token
  let decoded;
  try {
    decoded = securityConfig.verifyJWT(token);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    return next(new AppError('Token verification failed', 401));
  }

  // 3) Check if user still exists
  const currentUser = await userRepository.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  // 4) Check if user is active
  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401));
  }

  // 5) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('User recently changed password! Please log in again.', 401));
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

// Restrict to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Optional authentication - don't fail if no token
exports.optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = securityConfig.verifyJWT(token);
    const currentUser = await userRepository.findById(decoded.id);
    
    if (currentUser && currentUser.isActive) {
      req.user = currentUser;
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
});

// API Key authentication
exports.requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return next(new AppError('API key is required', 401));
  }

  if (!securityConfig.validateAPIKey(apiKey)) {
    return next(new AppError('Invalid API key', 401));
  }

  req.apiKey = apiKey;
  next();
};

// Generate JWT token
exports.signToken = (id) => {
  return securityConfig.generateJWT({ id });
};

// Create and send token
exports.createSendToken = (user, statusCode, res) => {
  const token = exports.signToken(user.id);
  const jwtConfig = securityConfig.getJWTConfig();
  
  // Calculate cookie expiration
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// Logout
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.status(200).json({ 
    status: 'success',
    message: 'Logged out successfully'
  });
};

// Check if user is logged in (for rendered pages)
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      const decoded = securityConfig.verifyJWT(req.cookies.jwt);
      const currentUser = await userRepository.findById(decoded.id);
      
      if (!currentUser || !currentUser.isActive) {
        return next();
      }

      if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      req.user = currentUser;
      return next();
    } catch (error) {
      return next();
    }
  }
  next();
};

// Rate limiting for authentication endpoints
exports.authRateLimit = (req, res, next) => {
  // This would typically use a more sophisticated rate limiting
  // For now, we'll use the general rate limiting from security config
  next();
};

// Validate password strength
exports.validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Middleware to validate password strength
exports.checkPasswordStrength = (req, res, next) => {
  if (req.body.password) {
    const validation = exports.validatePasswordStrength(req.body.password);
    if (!validation.isValid) {
      return next(new AppError(`Password requirements not met: ${validation.errors.join(', ')}`, 400));
    }
  }
  next();
};
