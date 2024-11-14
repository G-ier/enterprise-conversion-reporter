const knex = require("knex");
const knexConfig = require("../../../knexfile");

class DatabaseConnection {
  static instance;

  static getConnection() {
    if (!DatabaseConnection.instance) {
      const config = knexConfig["production"];
      DatabaseConnection.instance = knex(config);
    }
    return DatabaseConnection.instance;
  }

  static closeConnection() {
    DatabaseConnection.instance.destroy();
    DatabaseConnection.instance = null;
  }

}

module.exports = DatabaseConnection;
