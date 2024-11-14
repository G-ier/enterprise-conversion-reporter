// Third Party Imports
const { createClient } = require('@clickhouse/client')

// Local Application Imports
const EnvironmentVariablesManager = require("../services/EnvironmentVariablesManager");
const { ServerLogger } = require("../utils/logger");

class ClickhouseConnection {

  constructor() {

    if (!ClickhouseConnection.instance) {

        // Configure & initialize the connection
        let databaseConfiguration = {
            url: EnvironmentVariablesManager.getEnvVariable("CLICKHOUSE_URL")
        }   
        this.connection = createClient(databaseConfiguration);
        ClickhouseConnection.instance = this;

        // Log the connection initialization
        ServerLogger.info("Clickhouse Connection Initialized");
    }
    return ClickhouseConnection.instance;
  }

  getConnection() {
    return this.connection;
  }

  closeConnection() {

    // Close the connection
    ServerLogger.info("Clickhouse Connection Closed");
    return this.connection.close();
  }
}

module.exports = ClickhouseConnection;