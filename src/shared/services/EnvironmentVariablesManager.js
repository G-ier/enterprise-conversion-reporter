require('dotenv').config();

// Load the AWS SDK
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const fs = require("fs");
const os = require('os');

class EnvironmentVariablesManager {
  static instance = null;
  static initialized = false;

  static secrets = [

    // SQS
    "TRIGGER_CONVERSION_REPORTS_QUEUE_URL",
    "REPORT_CONVERSIONS_QUEUE_URL",

    // Clickhouse
    "CLICKHOUSE_URL",

    // Database
    "DATABASE_URL",
    "MONGODB_URI_TEST",
    "MONGODB_DATABASE"

  ];

  static parameters = [

    // Server settings
    "PORT",

    // Logging
    "LOG_LEVEL",

    // Polling
    "DISABLE_POLLING_FOR_CONVERSION_REPORTS_TRIGGER",
    "DISABLE_POLLING_FOR_CONVERSION_REPORTING",
    "DISABLE_SUBSCRIPTION_FILTERING"
  ];

  get isInitialized() {
    return !!this._initialized; // Use a private property _initialized for internal tracking
  }

  constructor() {
    if (!EnvironmentVariablesManager.instance) {
      // Check if the runtime environment is development or production
      this.environmentLocation = process.env.ENVIRONMENT_LOCATION === "local" ? "Local" : "AWS Cloud";
      this.region = "us-east-1";
      this.secretsManager = new SecretsManagerClient({
        region: this.region,
      });
      this.parametersManager = new SSMClient({
        region: this.region,
      });
      this.cachedValues = {}; // Object to hold cached secrets
      EnvironmentVariablesManager.instance = this;
    }
    return EnvironmentVariablesManager.instance;
  }

  cacheValue(value) {
    let parsedValue;
    try {
      if (value === "true" || value === "false") {
        parsedValue = value;
      } else {
        parsedValue = JSON.parse(value);
      }
    } catch (error) {
      parsedValue = value;
    }
    return parsedValue;
  }

  // Retrieve a parameter from the AWS SSM Parameter Store
  async retrieveParameter(parameterName) {
    // Check if the parameter is stored in the parameters manager
    if (!EnvironmentVariablesManager.parameters.includes(parameterName)) {
      throw new Error(`No secret ${parameterName} stored in manager`);
    }

    try {
      const params = {
        Name: parameterName,
        WithDecryption: true,
      };
      const data = await this.parametersManager.send(new GetParameterCommand(params));

      // Parse the parameter value & store it in the cache
      const parameterValue = data.Parameter.Value;
      this.cachedValues[parameterName] = this.cacheValue(parameterValue);
      return parameterValue;
    } catch (error) {
      console.error(`❌ Error retrieving parameter ${parameterName}: ${error}`);
      return null;
    }
  }

  // Retrieve a secret from the AWS Secrets Manager
  async retrieveSecret(secretName, singleValue = true) {
    // Check if the secret is stored in the manager
    if (!EnvironmentVariablesManager.secrets.includes(secretName)) {
      throw new Error(`No secret ${secretName} stored in manager`);
    }

    try {
      const params = {
        SecretId: secretName,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      };
      const data = await this.secretsManager.send(new GetSecretValueCommand(params));

      // Parse the secret value & store it in the cache
      const secretString = data.SecretString;
      const secretValue = secretString ? JSON.parse(secretString) : null;
      const value = singleValue && secretValue ? secretValue[secretName] : secretValue;
      this.cachedValues[secretName] = this.cacheValue(value);

      return value;
    } catch (error) {
      console.error(`❌ Error retrieving secret ${secretName}: ${error}`);
      return null;
    }
  }

  // Initialize the service by retrieving all secrets and parameters
  async init() {
    if (this.environmentLocation === "Local") {
      const envVars = EnvironmentVariablesManager.secrets.concat(EnvironmentVariablesManager.parameters);
      for (const secretName of envVars) {
        this.cachedValues[secretName] = this.cacheValue(process.env[secretName]);
      }
    } else {

        const requiredEnvVariables = ["LOGGING_ENVIRONMENT", "STACK"];

        // Overwriting the env variables with the ones from the file
        const dotenv = require("dotenv");
        let envFilePath;
        if (os.platform() === 'win32') {
          envFilePath = "C:\\Program Files\\efflux-conversion-reporting.env";
        } else if (os.platform() === 'linux') {
          envFilePath = "/etc/profile.d/efflux-conversion-reporting.env";
        } else if (os.platform() === 'darwin') {
          envFilePath = "/etc/efflux-conversion-reporting.env";
        }

        const fileExists = fs.existsSync(envFilePath);
        const fileContent = fileExists ? fs.readFileSync(envFilePath, "utf8").trim() : "";
        const envConfig = fileContent ? dotenv.parse(fileContent) : {};

        const missingVariables = requiredEnvVariables.filter((key) => !envConfig[key]);
        // Throw an error if any of the required env variables are missing
        if (missingVariables.length > 0) {
            throw new Error(`
                Missing required environment variables: ${missingVariables.join(", ")}.
                Please ensure it's/they are set in ${envFilePath}.

                Example:
                LOGGING_ENVIRONMENT=production
                STACK=CR
            `);
        }

        for (const [key, value] of Object.entries(envConfig)) {
            this.cachedValues[key] = value;
        }

        for (const secretName of EnvironmentVariablesManager.secrets) {
            await this.retrieveSecret(secretName);
        }
        for (const parameterName of EnvironmentVariablesManager.parameters) {
            await this.retrieveParameter(parameterName);
        }
    }
    EnvironmentVariablesManager.initialized = true;
  }

  // Get an env variable from the cache
  getEnvVariable(envVariableName) {
    if (!EnvironmentVariablesManager.initialized) {
      return this.cacheValue(process.env[envVariableName]);
    }
    return this.cachedValues[envVariableName] ? this.cachedValues[envVariableName] : null;
  }
}

// Export as a singleton
const instance = new EnvironmentVariablesManager();
Object.freeze(instance);

module.exports = instance;
