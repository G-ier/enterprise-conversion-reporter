// Third party imports
require("dotenv").config();
const express = require("express");

// Local imports
const EnvironmentVariablesManager = require("../src/shared/services/EnvironmentVariablesManager");

const initPollingForConversionReportsTrigger = async () => {

  // If polling is disabled, return
  if (EnvironmentVariablesManager.getEnvVariable("DISABLE_POLLING_FOR_CONVERSION_REPORTS_TRIGGER") === "true") {
    return;
  }

  // Initialize dependencies
  const SQSService = require("../src/shared/lib/SQSService");
  const QueuePoller = require("../src/shared/services/QueuePoller");
  const ConversionsFilter = require("../src/core/conversionReporter/ConversionsFilter");
  const { TriggerConversionReportsQueueLogger } = require("../src/shared/lib/WinstonLogger");

  // Initialize SQS service and queue poller
  const triggerConversionReportsQueueUrl = EnvironmentVariablesManager.getEnvVariable("TRIGGER_CONVERSION_REPORTS_QUEUE_URL");
  const triggerConversionReportsSQSService = new SQSService(triggerConversionReportsQueueUrl);
  const conversionsFilter = new ConversionsFilter();
  const triggerConversionReportsQueuePoller = new QueuePoller(triggerConversionReportsSQSService, async (message) => {
    await conversionsFilter.processQueueMessage(message);
  });

  // Start polling
  triggerConversionReportsQueuePoller.poll();

  TriggerConversionReportsQueueLogger.info("Polling for conversion reports trigger started");
};

// Initialize API
const initializeServer = async () => {

  // Retrieve environment variables
  await EnvironmentVariablesManager.init(); 
  const { ServerLogger } = require("../src/shared/lib/WinstonLogger");
  ServerLogger.info("Environment variables initialized");

  // Initialize server
  const server = express();
  server.get("/", (req, res) => {
    res.send("The world is yours!");
  });

  // Initialize polling for conversion reports trigger
  initPollingForConversionReportsTrigger();  

  // Start server
  const port = EnvironmentVariablesManager.getEnvVariable("PORT") || 5000;

  server.listen(port, () => {

    const loggingEnvironment = EnvironmentVariablesManager.getEnvVariable("LOGGING_ENVIRONMENT");
    const logLevel = EnvironmentVariablesManager.getEnvVariable("LOG_LEVEL");
    const triggerConversionReportsQueueUrl = EnvironmentVariablesManager.getEnvVariable("TRIGGER_CONVERSION_REPORTS_QUEUE_URL");
    const disablePollingForConversionReportsTrigger = EnvironmentVariablesManager.getEnvVariable("DISABLE_POLLING_FOR_CONVERSION_REPORTS_TRIGGER");

    ServerLogger.info(`

      Server Info:
        Port: ${port}
        Environment Location: ${process.env.ENVIRONMENT_LOCATION === "local" ? "Local" : "AWS Cloud"}

      Logging:
        Environment: ${loggingEnvironment || "development"}
        Log Level: ${logLevel || "info"}

      Trigger Conversion Reports Queue:
        URL: ${triggerConversionReportsQueueUrl} 
        Polling: ${disablePollingForConversionReportsTrigger === "true" ? "❌ Disabled" : "✅ Enabled"}
    `);
  });
}

module.exports = {
    initializeServer
}