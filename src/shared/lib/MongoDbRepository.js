const mongoClient = require('./MongoDbConnection');
const { ObjectId } = require('mongodb');
const EnvironmentVariablesManager = require('../services/EnvironmentVariablesManager');
const { ServerLogger } = require('../utils/logger');

class BaseMongoRepository {

  constructor(collectionName) {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    this.databaseName = EnvironmentVariablesManager.getEnvVariable("MONGODB_DATABASE");
    this.collectionName = collectionName;
    this._collection = null;
  }

  async getCollection() {
    try {
      // If we already have a collection instance, return it
      if (this._collection) {
        return this._collection;
      }

      ServerLogger.info(`Getting collection ${this.collectionName}`);
      
      // Connect only if not already connected
      if (!mongoClient.client.topology || !mongoClient.client.topology.isConnected()) {
        await mongoClient.connect();
      }
      
      this._collection = mongoClient.client.db(this.databaseName).collection(this.collectionName);
      return this._collection;
    } catch (error) {
      ServerLogger.error(`Error getting collection ${this.collectionName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new document
   * @param {Object} data - The document to create
   * @returns {Promise<string>} The ID of the created document
   */
  async create(data) {
    const collection = await this.getCollection();
    const document = {
      ...data,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(document);
    return result.insertedId;
  }

  /**
   * Find a document by ID
   * @param {string} id - The document ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find a document by session_id and keyword_clicked
   * @param {string} session_id - The session ID
   * @param {string} keyword_clicked - The keyword clicked
   * @returns {Promise<Object|null>}
   */
  async findBySessionIdAndKeywordClicked(session_id, keyword_clicked) {
    try {
      ServerLogger.info(`Finding document for session ${session_id} and keyword ${keyword_clicked}`);
      
      const collection = await this.getCollection();
      const document = await collection.findOne({ 
        session_id: session_id, 
        keyword_clicked: keyword_clicked 
      });
      
      return document;
    } catch (error) {
      ServerLogger.error(`Error finding document by session_id and keyword_clicked: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find documents by query
   * @param {Object} query - MongoDB query
   * @param {Object} options - Query options (sort, projection, etc.)
   * @returns {Promise<Array>}
   */
  async find(query = {}, options = {}) {
    const collection = await this.getCollection();
    const {
      sort = { createdAt: -1 },
      limit = 50,
      skip = 0,
      projection = null
    } = options;

    return await collection
      .find(query, { projection })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find one document by query
   * @param {Object} query - MongoDB query
   * @param {Object} options - Query options (projection, etc.)
   * @returns {Promise<Object|null>}
   */
  async findOne(query, options = {}) {
    const collection = await this.getCollection();
    return await collection.findOne(query, options);
  }

  /**
   * Update a document by ID
   * @param {string} id - The document ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<boolean>} Whether the document was updated
   */
  async update(id, updateData) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Update a singular document by update query
   * @param {Object} query - The update query
   * @param {Object} updateData - The data to update
   * @returns {Promise<boolean>} Whether the document was updated
   */
  async updateByQuery(query, updateData) {
    try {
      const collection = await this.getCollection();
      const result = await collection.updateOne(
        query,
        {
          $set: {
            ...updateData,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } finally {
      await mongoClient.disconnect();
    }
  }

  /**
   * Delete a document by ID
   * @param {string} id - The document ID
   * @returns {Promise<boolean>} Whether the document was deleted
   */
  async delete(id) {
    try {
      const collection = await this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } finally {
      await mongoClient.disconnect();
    }
  }

  /**
   * Count documents matching a query
   * @param {Object} query - MongoDB query
   * @returns {Promise<number>}
   */
  async count(query = {}) {
    try {
      const collection = await this.getCollection();
      return await collection.countDocuments(query);
    } finally {
      await mongoClient.disconnect();
    }
  }

  /**
   * Update many documents
   * @param {Object} query - MongoDB query
   * @param {Object} updateData - The data to update
   * @returns {Promise<number>} Number of documents modified
   */
  async updateMany(query, updateData) {
    try {
      const collection = await this.getCollection();
      const result = await collection.updateMany(
        query,
        {
          $set: {
            ...updateData,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount;
    } finally {
      await mongoClient.disconnect();
    }
  }

  /**
  * Execute an aggregation pipeline
  * @param {Array} pipeline - An aggregation pipeline array
  * @returns {Promise<Array>} The aggregation result
  */
  async aggregate(pipeline) {
    try {
      const collection = await this.getCollection();
      return await collection.aggregate(pipeline).toArray();
    } finally {
      await mongoClient.disconnect();
    }
  }
}

module.exports = BaseMongoRepository;
