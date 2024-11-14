// Third party imports
require("dotenv").config();
const pg = require("pg");

// Local imports
const EnvironmentVariablesManager = require("./src/shared/services/EnvironmentVariablesManager");
pg.defaults.ssl = { rejectUnauthorized: false };

module.exports = {
  production: {
    client: "pg",
    connection: EnvironmentVariablesManager.getEnvVariable("DATABASE_URL"),
    pool: {
      min: 0,
      max: 12,
      acquireTimeoutMillis: 120000,
    },
    useNullAsDefault: true,
    ssl: { rejectUnauthorized: false },
  },
  onUpdateTrigger: (table) => `
    CREATE TRIGGER updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW
    EXECUTE PROCEDURE updated_at_column();
  `,
};
