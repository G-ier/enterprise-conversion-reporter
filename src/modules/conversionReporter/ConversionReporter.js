const S3Service = require('../../shared/lib/S3Service');
const ClickHouseService = require('../../shared/lib/ClickHouseService');
// const FacebookService = require('./services/FacebookService');
const { ConversionReporterLogger } = require('../../shared/utils/logger');
const { MetricsCollector } = require('../../shared/utils/monitoring');

class ConversionReporter {

    constructor() {
        // this.facebookService = new FacebookService();
        this.metricsCollector = new MetricsCollector('ConversionReporter');
    }

    async processQueueMessage(message) {
        const timer = this.metricsCollector.startTimer('processMessage');
        try {
            const body = JSON.parse(message.Body);
            const s3Record = body.Records[0];
            const conversions = await this.getConversionsFromS3(s3Record);
            
            // Filter out already reported conversions
            const newConversions = await this.filterExistingConversions(conversions);
            
            if (newConversions.length > 0) {
                await Promise.all([
                    this.reportToClickHouse(newConversions),
                    this.reportToFacebook(newConversions)
                ]);
            }

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
        // TODO: Implement this
        return conversions;
    }

    async reportToClickHouse(conversions) {
        // TODO: Implement this
        // await ClickHouseService.insertConversions(conversions);
        return true;
    }

    async reportToFacebook(conversions) {
        // TODO: Implement this
        // await this.facebookService.reportConversions(conversions);
        return true;
    }
}

module.exports = ConversionReporter;