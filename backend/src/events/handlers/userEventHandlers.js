const logger = require('../../config/logger');
const { USER_EVENTS, NOTIFICATION_EVENTS } = require('../eventTypes');
const { eventBus } = require('../eventBus');

class UserEventHandlers {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle user created events
    eventBus.subscribe(USER_EVENTS.USER_CREATED, this.handleUserCreated.bind(this), {
      retry: true,
      maxRetries: 3,
      retryDelay: 1000
    });

    // Handle user login events
    eventBus.subscribe(USER_EVENTS.USER_LOGIN, this.handleUserLogin.bind(this));

    // Handle user updated events
    eventBus.subscribe(USER_EVENTS.USER_UPDATED, this.handleUserUpdated.bind(this));

    // Handle user deleted events
    eventBus.subscribe(USER_EVENTS.USER_DELETED, this.handleUserDeleted.bind(this));

    logger.info('User event handlers initialized');
  }

  async handleUserCreated(event) {
    try {
      const { userId, email, username, firstName, lastName } = event.data;

      logger.info(`Processing user created event for user: ${email}`, { 
        eventId: event.id,
        userId 
      });

      // Send welcome email notification
      await this.sendWelcomeEmail(event);

      // Create user profile analytics entry
      await this.createUserAnalytics(event);

      // Set up default user preferences
      await this.setupDefaultPreferences(event);

      logger.info(`User created event processed successfully for user: ${email}`, { 
        eventId: event.id,
        userId 
      });

    } catch (error) {
      logger.error(`Error processing user created event: ${event.id}`, error);
      throw error;
    }
  }

  async handleUserLogin(event) {
    try {
      const { userId, email, loginTime, ipAddress } = event.data;

      logger.info(`Processing user login event for user: ${email}`, { 
        eventId: event.id,
        userId 
      });

      // Update user analytics
      await this.updateLoginAnalytics(event);

      // Check for suspicious login activity
      await this.checkSuspiciousActivity(event);

      // Update user's last seen status
      await this.updateLastSeenStatus(event);

      logger.info(`User login event processed successfully for user: ${email}`, { 
        eventId: event.id,
        userId 
      });

    } catch (error) {
      logger.error(`Error processing user login event: ${event.id}`, error);
      throw error;
    }
  }

  async handleUserUpdated(event) {
    try {
      const { userId, updatedFields } = event.data;

      logger.info(`Processing user updated event for user: ${userId}`, { 
        eventId: event.id,
        userId,
        updatedFields 
      });

      // Update search index if profile fields changed
      if (this.hasProfileChanges(updatedFields)) {
        await this.updateSearchIndex(event);
      }

      // Send notification if email changed
      if (updatedFields.includes('email')) {
        await this.sendEmailChangeNotification(event);
      }

      // Update user analytics
      await this.updateUserAnalytics(event);

      logger.info(`User updated event processed successfully for user: ${userId}`, { 
        eventId: event.id,
        userId 
      });

    } catch (error) {
      logger.error(`Error processing user updated event: ${event.id}`, error);
      throw error;
    }
  }

  async handleUserDeleted(event) {
    try {
      const { userId, email, reason } = event.data;

      logger.info(`Processing user deleted event for user: ${email}`, { 
        eventId: event.id,
        userId,
        reason 
      });

      // Clean up user data
      await this.cleanupUserData(event);

      // Send account deletion confirmation
      await this.sendDeletionConfirmation(event);

      // Update analytics
      await this.updateDeletionAnalytics(event);

      logger.info(`User deleted event processed successfully for user: ${email}`, { 
        eventId: event.id,
        userId 
      });

    } catch (error) {
      logger.error(`Error processing user deleted event: ${event.id}`, error);
      throw error;
    }
  }

  // Helper methods
  async sendWelcomeEmail(event) {
    const { email, firstName, username } = event.data;

    // Publish email notification event
    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      to: email,
      subject: 'Welcome to our platform!',
      template: 'welcome',
      data: {
        firstName: firstName || username,
        username
      },
      priority: 'normal'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId: event.data.userId
    });

    logger.debug(`Welcome email queued for user: ${email}`);
  }

  async createUserAnalytics(event) {
    // This would typically integrate with an analytics service
    logger.debug(`Creating analytics entry for user: ${event.data.userId}`);
    
    // Simulate analytics creation
    const analyticsData = {
      userId: event.data.userId,
      event: 'user_registered',
      timestamp: event.metadata.timestamp,
      properties: {
        registrationMethod: event.metadata.source || 'web',
        hasFirstName: !!event.data.firstName,
        hasLastName: !!event.data.lastName
      }
    };

    // In a real implementation, this would send to analytics service
    logger.debug('User analytics created', analyticsData);
  }

  async setupDefaultPreferences(event) {
    logger.debug(`Setting up default preferences for user: ${event.data.userId}`);
    
    // This would typically update the user's preferences in the database
    // For now, we'll just log it
    const defaultPreferences = {
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      theme: 'auto',
      language: 'en'
    };

    logger.debug('Default preferences set', { 
      userId: event.data.userId,
      preferences: defaultPreferences 
    });
  }

  async updateLoginAnalytics(event) {
    const { userId, ipAddress, userAgent } = event.data;

    logger.debug(`Updating login analytics for user: ${userId}`);

    // This would typically update analytics/metrics
    const loginAnalytics = {
      userId,
      loginTime: event.metadata.timestamp,
      ipAddress,
      userAgent,
      source: event.metadata.source
    };

    logger.debug('Login analytics updated', loginAnalytics);
  }

  async checkSuspiciousActivity(event) {
    const { userId, ipAddress } = event.data;

    // Simple suspicious activity check (in real implementation, this would be more sophisticated)
    logger.debug(`Checking suspicious activity for user: ${userId} from IP: ${ipAddress}`);

    // This would typically check against known patterns, geolocation, etc.
    // For now, we'll just log it
    logger.debug('Suspicious activity check completed', { userId, ipAddress });
  }

  async updateLastSeenStatus(event) {
    const { userId } = event.data;

    logger.debug(`Updating last seen status for user: ${userId}`);

    // This would typically update the user's last seen timestamp in the database
    // For now, we'll just log it
    logger.debug('Last seen status updated', { 
      userId,
      lastSeen: event.metadata.timestamp 
    });
  }

  hasProfileChanges(updatedFields) {
    const profileFields = ['firstName', 'lastName', 'email', 'profile'];
    return updatedFields.some(field => profileFields.includes(field));
  }

  async updateSearchIndex(event) {
    const { userId } = event.data;

    logger.debug(`Updating search index for user: ${userId}`);

    // This would typically update a search index (Elasticsearch, etc.)
    // For now, we'll just log it
    logger.debug('Search index updated', { userId });
  }

  async sendEmailChangeNotification(event) {
    const { userId, email } = event.data;

    logger.debug(`Sending email change notification for user: ${userId}`);

    // Publish email notification event
    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      to: email,
      subject: 'Email address changed',
      template: 'email_changed',
      data: {
        userId,
        changeTime: event.metadata.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });
  }

  async updateUserAnalytics(event) {
    const { userId, updatedFields } = event.data;

    logger.debug(`Updating user analytics for user: ${userId}`);

    // This would typically send analytics events
    const analyticsData = {
      userId,
      event: 'user_updated',
      timestamp: event.metadata.timestamp,
      properties: {
        updatedFields,
        updateSource: event.metadata.source
      }
    };

    logger.debug('User update analytics recorded', analyticsData);
  }

  async cleanupUserData(event) {
    const { userId } = event.data;

    logger.debug(`Cleaning up data for user: ${userId}`);

    // This would typically clean up user-related data across services
    // For now, we'll just log it
    logger.debug('User data cleanup completed', { userId });
  }

  async sendDeletionConfirmation(event) {
    const { email } = event.data;

    logger.debug(`Sending deletion confirmation to: ${email}`);

    // Publish email notification event
    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      to: email,
      subject: 'Account deletion confirmation',
      template: 'account_deleted',
      data: {
        deletionTime: event.metadata.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id
    });
  }

  async updateDeletionAnalytics(event) {
    const { userId, reason } = event.data;

    logger.debug(`Recording deletion analytics for user: ${userId}`);

    // This would typically record deletion metrics
    const analyticsData = {
      userId,
      event: 'user_deleted',
      timestamp: event.metadata.timestamp,
      properties: {
        reason,
        deletionSource: event.metadata.source
      }
    };

    logger.debug('User deletion analytics recorded', analyticsData);
  }
}

module.exports = UserEventHandlers;
