// Local Application Imports
const S3Service = require('../../shared/lib/S3Service');
const ClickHouseService = require('../../shared/lib/ClickHouseService');
const FacebookService = require('./services/FacebookService');
const TiktokService = require('./services/TiktokService');
const DatabaseRepository = require('../../shared/lib/DatabaseRepository');
const { ConversionReporterLogger } = require('../../shared/utils/logger');
const { MetricsCollector } = require('../../shared/utils/monitoring');
const isTimestampOlderThan7d = require('./utils/isTimestampOlderThan7d');

class ConversionReporter {

    constructor() {
        this.facebookService = new FacebookService();
        this.tiktokService = new TiktokService();
        this.metricsCollector = new MetricsCollector('ConversionReporter');
        this.clickHouseService = new ClickHouseService()
        this.repository = new DatabaseRepository();
    }

    /**
     * Processes an SQS message containing S3 event records with conversion data.
     * Filters out existing conversions, validates them, and reports to ClickHouse and Facebook.
     * Tracks processing metrics and handles errors.
     * @param {Object} message - SQS message containing S3 event records
     * @throws {Error} If message processing fails
     */
    async processQueueMessage(message) {

        const timer = this.metricsCollector.startTimer('processMessage');
        try {
            ConversionReporterLogger.info(`Conversion Reporter: Processing message`);
            const body = JSON.parse(message.Body);
            const s3Record = body.Records[0];
            const conversions = await this.getConversionsFromS3(s3Record);

            // Filter out already reported conversions
            const newConversions = await this.filterConversions(conversions);
            ConversionReporterLogger.info(`✅ New conversions: ${newConversions.length} records`);

            // Filter valid conversions
            const validConversions = newConversions.filter(conversion => conversion.valid);
            const invalidConversions = newConversions.filter(conversion => !conversion.valid);
            ConversionReporterLogger.info(`❌ Invalid conversions: ${invalidConversions.length} records`);

            if (newConversions.length > 0) {
                await Promise.all([

                    // Save all conversions to ClickHouse
                    this.reportToClickHouse(newConversions),

                    // Report only the valid ones to Facebook
                    this.reportToFacebook(validConversions)
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

    /**
     * Retrieves conversion data from an S3 bucket using the provided S3 record.
     * @param {Object} s3Record - S3 event record containing object key
     * @returns {Promise<Array>} Array of conversion objects
     */
    async getConversionsFromS3(s3Record) {
        const s3Key = decodeURIComponent(s3Record.s3.object.key);
        return S3Service.readDataFromFolder('report-conversions-bucket', s3Key);
    }

    /**
     * Labels conversion events as valid/invalid based on:
     * - Facebook pixel existence
     * - Click timestamp age (< 7 days)
     * - Presence of ts_click_id
     * Mutates the input array by adding a 'valid' property to each conversion.
     * @param {Array} conversions - Array of conversion objects to validate
     */
    async labelBrokenEvents(conversions) {

        // Step 1: Fetch the pixels for the Facebook traffic source.
        const pixels = await this.repository.query('pixels', ['code'], {traffic_source: 'facebook'});
        const pixelIds = pixels.map(pixel => pixel.code);

        // Step 2: Label the events as invalid if they don't have a valid pixel, a valid ts_click_id or are older than 7 days.
        for (const conversion of conversions) {
            if (!pixelIds.includes(conversion.pixel_id)) {
                conversion.valid = false;
                conversion.invalid_reason = 'Invalid pixel';
            } else if (!isTimestampOlderThan7d(conversion.click_timestamp)) {
                conversion.valid = false;
                conversion.invalid_reason = 'Conversion older than 7 days';
            } else if (["", null, undefined].includes(conversion.ts_click_id)) {
                conversion.valid = false;
                conversion.invalid_reason = 'Missing traffic source click id';
            } else {
                conversion.valid = true;
            }
        }
    }

    /**
     * Filters out previously reported conversions and invalid events.
     * 1. Fetches existing conversions from ClickHouse
     * 2. Creates a map of existing conversion keys
     * 3. Filters out duplicates using session_id and keyword_clicked
     * 4. Labels and filters out invalid conversions
     * @param {Array} conversions - Array of new conversion objects
     * @returns {Promise<Array>} Filtered array of valid, unreported conversions
     */
    async filterConversions(conversions) {

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
        
        // Step 3: Label the broken events. Mark the invalid ones as such. (inexisting pixels & unix timestamps older than 7 days)
        await this.labelBrokenEvents(newConversions);

        // Step 4: Return the new ones
        return newConversions;
    }

    /**
     * Reports conversion data to ClickHouse database.
     * @param {Array} conversions - Array of conversion objects to report
     * @returns {Promise<boolean>} True if reporting successful
     */
    async reportToClickHouse(conversions) {
        ConversionReporterLogger.info('Conversion Reporter: Reporting to ClickHouse');
        await this.clickHouseService.insert('report_conversions', conversions);
        return true;
    }

    /**
     * Reports conversion data to Facebook's API.
     * @param {Array} conversions - Array of conversion objects to report
     * @returns {Promise<boolean>} True if reporting successful
     */
    async reportToFacebook(conversions) {
        ConversionReporterLogger.info('Conversion Reporter: Reporting to Facebook');
        await this.facebookService.reportConversions(conversions);
        return true;
    }

    /**
     * Reports conversion data to TikTok's API (Not implemented).
     * @param {Array} conversions - Array of conversion objects to report
     */
    async reportToTiktok(conversions) {
    }
}

module.exports = ConversionReporter;