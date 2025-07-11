const { MongoClient, ServerApiVersion } = require('mongodb');
const EnvironmentVariablesManager = require('../services/EnvironmentVariablesManager');
const { ServerLogger } = require('../utils/logger');

class MongoDBClient {

  constructor() {
    this.uri = EnvironmentVariablesManager.getEnvVariable("MONGODB_URI_TEST");
    if (!this.uri) {
      throw new Error('MONGODB_URI_TEST or MONGODB_URI environment variable is not set');
    }
    this.client = new MongoClient(this.uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
  }

  async connect() {
    try {
      ServerLogger.info('Attempting to connect to MongoDB...');
      await this.client.connect();
      ServerLogger.info('Successfully connected to MongoDB');
      return true;
    } catch (error) {
      ServerLogger.error(`MongoDB connection error: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.close();
      ServerLogger.info("Disconnected from MongoDB");
    } catch (error) {
      ServerLogger.error(`MongoDB disconnection error: ${error.message}`);
      throw error;
    }
  }
}

// Create and freeze a single instance
module.exports = Object.freeze(new MongoDBClient());
