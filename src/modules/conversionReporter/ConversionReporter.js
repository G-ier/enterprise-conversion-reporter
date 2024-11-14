const S3Service = require('../../shared/lib/S3Service');
const ClickHouseService = require('../../shared/lib/ClickHouseService');
// const FacebookService = require('./services/FacebookService');
const { ConversionReporterLogger } = require('../../shared/utils/logger');
const { MetricsCollector } = require('../../shared/utils/monitoring');

class ConversionReporter {

    constructor() {
        // this.facebookService = new FacebookService();
        this.metricsCollector = new MetricsCollector('ConversionReporter');
        this.clickHouseService = new ClickHouseService()
    }

    async processQueueMessage(message) {

        const timer = this.metricsCollector.startTimer('processMessage');
        try {
            ConversionReporterLogger.info(`Conversion Reporter: Processing message`);
            const body = JSON.parse(message.Body);
            const s3Record = body.Records[0];
            const conversions = await this.getConversionsFromS3(s3Record);

            // Filter out already reported conversions
            const newConversions = await this.filterExistingConversions(conversions);
            ConversionReporterLogger.info(`✅ New conversions: ${newConversions.length} records`);

            if (newConversions.length > 0) {
                await Promise.all([
                    this.reportToClickHouse(newConversions),
                    this.reportToFacebook(newConversions)
                ]);
            }

            ConversionReporterLogger.info('Conversion Reporter: Message processed');
            timer.end();
            this.metricsCollector.incrementCounter('processedMessages');
        } catch (error) {
            timer.end();
            this.metricsCollector.incrementCounter('failedMessages');
            ConversionReporterLogger.error('❌ Error processing message:', error);
            throw error;
        }
    }

    async getConversionsFromS3(s3Record) {
        const s3Key = decodeURIComponent(s3Record.s3.object.key);
        return S3Service.readDataFromFolder('report-conversions-bucket', s3Key);
    }

    async filterExistingConversions(conversions) {

        ConversionReporterLogger.info('Conversion Reporter: Filtering existing conversions');

        // Step 1: Get all conversions from ClickHouse
        const existingConversions = await this.clickHouseService.dynamicQuery('report_conversions', ['*']);

        // Step 2: Filter out the ones that are already reported
        const existingConversionsMap = existingConversions.reduce((map, conversion) => {
            const key = `${conversion.session_id}-${conversion.keyword_clicked}`;
            map[key] = true;
            return map;
        }, {});
        const newConversions = conversions.filter(conversion => {
            const key = `${conversion.session_id}-${conversion.keyword_clicked}`;
            return !existingConversionsMap[key];
        });

        // Step 3: Return the new ones
        return newConversions;
    }

    async reportToClickHouse(conversions) {
        ConversionReporterLogger.info('Conversion Reporter: Reporting to ClickHouse');
        await this.clickHouseService.insert('report_conversions', conversions);
        return true;
    }

    async reportToFacebook(conversions) {
        // TODO: Implement this
        // await this.facebookService.reportConversions(conversions);
        return true;
    }
}

module.exports = ConversionReporter;