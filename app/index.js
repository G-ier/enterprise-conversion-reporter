// Third party imports
require("dotenv").config();
const express = require("express");
const cron = require('node-cron');

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
  const CampaignFilter = require("../src/modules/campaignFilter/CampaignFilter");
  const { TriggerConversionReportsQueueLogger } = require("../src/shared/utils/logger");

  // Initialize SQS service and queue poller
  const triggerConversionReportsQueueUrl = EnvironmentVariablesManager.getEnvVariable("TRIGGER_CONVERSION_REPORTS_QUEUE_URL");
  const triggerConversionReportsSQSService = new SQSService(triggerConversionReportsQueueUrl);
  const campaignsFilter = new CampaignFilter();
  const triggerConversionReportsQueuePoller = new QueuePoller(triggerConversionReportsSQSService, async (message) => {
    await campaignsFilter.processQueueMessage(message);
  });

  // Start polling
  triggerConversionReportsQueuePoller.poll();

  TriggerConversionReportsQueueLogger.info("Polling for conversion reports trigger started");
};

const initPollingForConversionReporting = async () => {
  // If polling is disabled, return
  if (EnvironmentVariablesManager.getEnvVariable("DISABLE_POLLING_FOR_CONVERSION_REPORTING") === "true") {
    return;
  }

  // Initialize dependencies
  const SQSService = require("../src/shared/lib/SQSService");
  const QueuePoller = require("../src/shared/services/QueuePoller");
  const ConversionReporter = require("../src/modules/conversionReporter/ConversionReporter");
  const { ReportConversionsQueueLogger } = require("../src/shared/utils/logger");

  // Initialize SQS service and queue poller
  const reportConversionsQueueUrl = EnvironmentVariablesManager.getEnvVariable("REPORT_CONVERSIONS_QUEUE_URL");
  const reportConversionsSQSService = new SQSService(reportConversionsQueueUrl);
  const conversionReporter = new ConversionReporter();
  const reportConversionsQueuePoller = new QueuePoller(reportConversionsSQSService, async (message) => {
    await conversionReporter.processQueueMessage(message);
  });

  // Start polling
  reportConversionsQueuePoller.poll();

  ReportConversionsQueueLogger.info("Polling for conversion reporting started");
};

// Initialize API
const initializeServer = async () => {

  // Retrieve environment variables
  await EnvironmentVariablesManager.init(); 
  const { ServerLogger } = require("../src/shared/utils/logger");
  ServerLogger.info("Environment variables initialized");

  // Initialize server
  const server = express();
  server.get("/", (req, res) => {
    res.send("The world is yours!");
  });

  // Initialize polling for both queues
  initPollingForConversionReportsTrigger();
  initPollingForConversionReporting();

  // Schedule the optimization to run every 3 hours
  const ClickHouseOptimizer = require('../src/modules/optimization/ClickHouseOptimizer');
  cron.schedule('0 1,4,7,10,13,16,19,22 * * *', async () => {
    const optimizer = new ClickHouseOptimizer();
    await optimizer.optimizeTable('report_conversions');
  });

  // Start server
  const port = EnvironmentVariablesManager.getEnvVariable("PORT") || 5000;

  server.listen(port, () => {

    const loggingEnvironment = EnvironmentVariablesManager.getEnvVariable("LOGGING_ENVIRONMENT");
    const logLevel = EnvironmentVariablesManager.getEnvVariable("LOG_LEVEL");
    const triggerConversionReportsQueueUrl = EnvironmentVariablesManager.getEnvVariable("TRIGGER_CONVERSION_REPORTS_QUEUE_URL");
    const reportConversionsQueueUrl = EnvironmentVariablesManager.getEnvVariable("REPORT_CONVERSIONS_QUEUE_URL");
    const disablePollingForConversionReportsTrigger = EnvironmentVariablesManager.getEnvVariable("DISABLE_POLLING_FOR_CONVERSION_REPORTS_TRIGGER");
    const disablePollingForConversionReporting = EnvironmentVariablesManager.getEnvVariable("DISABLE_POLLING_FOR_CONVERSION_REPORTING");
    const clickHouseUrl = EnvironmentVariablesManager.getEnvVariable("CLICKHOUSE_URL");

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

      Report Conversions Queue:
        URL: ${reportConversionsQueueUrl}
        Polling: ${disablePollingForConversionReporting === "true" ? "❌ Disabled" : "✅ Enabled"}

      ClickHouse:
        URL: ${clickHouseUrl}
    `);
  });
}

module.exports = {
    initializeServer
}