const crypto = require('crypto');

class SecurityConfig {
  constructor() {
    this.validateEnvironmentVariables();
  }

  validateEnvironmentVariables() {
    const requiredSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'SESSION_SECRET'
    ];

    const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);
    
    if (missingSecrets.length > 0) {
      throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
    }

    // Validate minimum length for security
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (process.env.ENCRYPTION_KEY.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }

    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long');
    }
  }

  getJWTConfig() {
    return {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'order-management-system',
      audience: process.env.JWT_AUDIENCE || 'order-management-users'
    };
  }

  getEncryptionConfig() {
    return {
      algorithm: 'aes-256-gcm',
      key: Buffer.from(process.env.ENCRYPTION_KEY, 'utf8').slice(0, 32),
      ivLength: 16
    };
  }

  getSessionConfig() {
    return {
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    };
  }

  getBcryptConfig() {
    return {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    };
  }

  getAPIKeyConfig() {
    return {
      secret: process.env.API_KEY_SECRET || this.generateRandomKey(),
      headerName: 'x-api-key'
    };
  }

  getWebhookConfig() {
    return {
      secret: process.env._STRIPE_WEBHOOK_SECRET || this.generateRandomKey()
    };
  }

  getPaymentConfig() {
    return {
      gatewaySecret: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    };
  }

  // Utility methods
  generateRandomKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(password) {
    const bcrypt = require('bcryptjs');
    const { saltRounds } = this.getBcryptConfig();
    return bcrypt.hash(password, saltRounds);
  }

  comparePassword(password, hash) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  encrypt(text) {
    const { algorithm, key, ivLength } = this.getEncryptionConfig();
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const { algorithm, key } = this.getEncryptionConfig();
    const { encrypted, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher(algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  generateJWT(payload) {
    const jwt = require('jsonwebtoken');
    const config = this.getJWTConfig();
    
    return jwt.sign(payload, config.secret, {
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience
    });
  }

  verifyJWT(token) {
    const jwt = require('jsonwebtoken');
    const config = this.getJWTConfig();
    
    return jwt.verify(token, config.secret, {
      issuer: config.issuer,
      audience: config.audience
    });
  }

  generateAPIKey() {
    const prefix = 'oms_'; // order management system
    const randomPart = this.generateRandomKey(16);
    return `${prefix}${randomPart}`;
  }

  validateAPIKey(apiKey) {
    // In a real implementation, you would check this against a database
    // For now, we'll just validate the format
    return apiKey && apiKey.startsWith('oms_') && apiKey.length === 36;
  }

  // Security headers configuration
  getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http: https:;"
    };
  }

  // Rate limiting configuration
  getRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    };
  }
}

module.exports = new SecurityConfig();
