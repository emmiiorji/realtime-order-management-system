const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    try {
      const document = new this.model(data);
      const savedDocument = await document.save();
      logger.debug(`Document created in ${this.model.modelName}`, { id: savedDocument.id });
      return savedDocument;
    } catch (error) {
      logger.error(`Error creating document in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async findById(id) {
    try {
      const document = await this.model.findOne({ id });
      return document;
    } catch (error) {
      logger.error(`Error finding document by ID in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async findOne(filter) {
    try {
      const document = await this.model.findOne(filter);
      return document;
    } catch (error) {
      logger.error(`Error finding document in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async findMany(filter = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        select,
        populate
      } = options;

      const skip = (page - 1) * limit;

      let query = this.model.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      if (select) {
        query = query.select(select);
      }

      if (populate) {
        query = query.populate(populate);
      }

      const documents = await query.exec();
      const total = await this.model.countDocuments(filter);

      return {
        data: documents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Error finding documents in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async updateById(id, updateData) {
    try {
      const document = await this.model.findOneAndUpdate(
        { id },
        updateData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404);
      }

      logger.debug(`Document updated in ${this.model.modelName}`, { id });
      return document;
    } catch (error) {
      logger.error(`Error updating document in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async updateOne(filter, updateData) {
    try {
      const document = await this.model.findOneAndUpdate(
        filter,
        updateData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404);
      }

      logger.debug(`Document updated in ${this.model.modelName}`);
      return document;
    } catch (error) {
      logger.error(`Error updating document in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async updateMany(filter, updateData) {
    try {
      const result = await this.model.updateMany(filter, updateData);
      logger.debug(`Documents updated in ${this.model.modelName}`, { 
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount 
      });
      return result;
    } catch (error) {
      logger.error(`Error updating documents in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async deleteById(id) {
    try {
      const document = await this.model.findOneAndDelete({ id });
      
      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404);
      }

      logger.debug(`Document deleted from ${this.model.modelName}`, { id });
      return document;
    } catch (error) {
      logger.error(`Error deleting document from ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async deleteOne(filter) {
    try {
      const document = await this.model.findOneAndDelete(filter);
      
      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404);
      }

      logger.debug(`Document deleted from ${this.model.modelName}`);
      return document;
    } catch (error) {
      logger.error(`Error deleting document from ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async deleteMany(filter) {
    try {
      const result = await this.model.deleteMany(filter);
      logger.debug(`Documents deleted from ${this.model.modelName}`, { 
        deletedCount: result.deletedCount 
      });
      return result;
    } catch (error) {
      logger.error(`Error deleting documents from ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async count(filter = {}) {
    try {
      const count = await this.model.countDocuments(filter);
      return count;
    } catch (error) {
      logger.error(`Error counting documents in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async exists(filter) {
    try {
      const document = await this.model.findOne(filter).select('_id');
      return !!document;
    } catch (error) {
      logger.error(`Error checking existence in ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async aggregate(pipeline) {
    try {
      const result = await this.model.aggregate(pipeline);
      return result;
    } catch (error) {
      logger.error(`Error in aggregation for ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async bulkWrite(operations) {
    try {
      const result = await this.model.bulkWrite(operations);
      logger.debug(`Bulk operation completed for ${this.model.modelName}`, {
        insertedCount: result.insertedCount,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount
      });
      return result;
    } catch (error) {
      logger.error(`Error in bulk operation for ${this.model.modelName}:`, error);
      throw this.handleError(error);
    }
  }

  async transaction(operations) {
    const session = await this.model.db.startSession();
    
    try {
      session.startTransaction();
      
      const results = [];
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      
      await session.commitTransaction();
      logger.debug(`Transaction completed successfully for ${this.model.modelName}`);
      return results;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Transaction failed for ${this.model.modelName}:`, error);
      throw this.handleError(error);
    } finally {
      session.endSession();
    }
  }

  handleError(error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return new AppError(`Validation error: ${messages.join(', ')}`, 400);
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return new AppError(`Duplicate value for field: ${field}`, 400);
    }
    
    if (error.name === 'CastError') {
      return new AppError('Invalid data format', 400);
    }
    
    if (error instanceof AppError) {
      return error;
    }
    
    return new AppError('Database operation failed', 500);
  }
}

module.exports = BaseRepository;
