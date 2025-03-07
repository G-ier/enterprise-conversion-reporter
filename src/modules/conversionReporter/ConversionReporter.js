// Local Application Imports
const S3Service = require('../../shared/lib/S3Service');
const ClickHouseService = require('../../shared/lib/ClickHouseService');
const BaseMongoRepository = require('../../shared/lib/MongoDbRepository');
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
        this.mongoRepository = new BaseMongoRepository('report_conversions');
        this.repository = new DatabaseRepository();
    }

    async transformLandings(conversions, network) {
        if (network === 'tonic' || network === 'sedo') {
            conversions.forEach(conversion => {
                conversion.landings = 1;
                conversion.serp_landings = 1;
            });
        } else if (network === 'crossroads') {
            conversions.forEach(conversion => {
                conversion.landings = conversion.lander_visitors;
                conversion.serp_landings = conversion.lander_searches;
            });
        }
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
            const encodedS3Key = s3Record.s3.object.key;
            const decodedS3Key = decodeURIComponent(encodedS3Key);
            const[moduleName, network, jobKey, accountName] = decodedS3Key.split("/");
            const conversions = await this.getConversionsFromS3(decodedS3Key);

            // Filter out already reported conversions
            const newConversions = await this.filterConversions(conversions);
            ConversionReporterLogger.info(`✅ New conversions: ${newConversions.length} records`);

            // Label the broken events as such.
            await this.labelBrokenEvents(newConversions);

            if (newConversions.length > 0) {

                // Filter valid and invalid conversions
                const validConversions = newConversions.filter(conversion => conversion.valid);
                const invalidConversions = newConversions.filter(conversion => !conversion.valid);
                ConversionReporterLogger.info(`❌ Invalid conversions: ${invalidConversions.length} records`);

                let successfullyReportedConversions = [];
                let failedConversions = [];

                if (validConversions.length > 0) {
                    // Report only the valid ones to Facebook
                    const facebookReportResults = await this.reportToFacebook(validConversions, network);
                    successfullyReportedConversions = facebookReportResults.successes;
                    failedConversions = facebookReportResults.failures;
                }
                
                // Mark reporting status
                successfullyReportedConversions.forEach(conv => {
                    conv.reported = 1;
                    // ClickHouse expects the timestamp in milliseconds
                    conv.click_timestamp = conv.click_timestamp * 1000;
                });
                failedConversions.forEach(conv => {
                    conv.reported = 0;
                    // ClickHouse expects the timestamp in milliseconds
                    conv.click_timestamp = conv.click_timestamp * 1000;
                });
                invalidConversions.forEach(conv => {
                    conv.reported = 0;
                    // ClickHouse expects the timestamp in milliseconds
                    conv.click_timestamp = conv.click_timestamp * 1000;
                });

                // Transform the landings and serp_landings fields based on the network.
                await this.transformLandings(successfullyReportedConversions, network);
                await this.transformLandings(failedConversions, network);
                await this.transformLandings(invalidConversions, network);

                // Save all conversions to MongoDB
                await this.reportToMongoDB([
                    ...successfullyReportedConversions,
                    ...failedConversions,
                    ...invalidConversions
                ]);
            }

            ConversionReporterLogger.info('Conversion Reporter: Message processed');
            timer.end();
            this.metricsCollector.incrementCounter('processedMessages');
        } catch (error) {
            timer.end();
            this.metricsCollector.incrementCounter('failedMessages');
            ConversionReporterLogger.error(`❌ Error processing message: ${error}`);
            throw error;
        }
    }    

    /**
     * Retrieves conversion data from an S3 bucket using the provided S3 record.
     * @param {Object} s3Record - S3 event record containing object key
     * @returns {Promise<Array>} Array of conversion objects
     */
    async getConversionsFromS3(s3Key) {
        return S3Service.readDataFromFolder('report-conversions-bucket', s3Key);
    }

    /**
     * Filters out previously reported conversions and invalid events.
     * 1. Fetches existing conversions from ClickHouse within the click_timestamp range of the batch
     * 2. Creates a map of existing conversion keys
     * 3. Filters out duplicates using session_id and keyword_clicked
     * 4. Labels and filters out invalid conversions
     * @param {Array} conversions - Array of new conversion objects
     * @returns {Promise<Array>} Filtered array of valid, unreported conversions
     */
    async filterConversions(conversions) {

        ConversionReporterLogger.info('Conversion Reporter: Filtering existing conversions');

        // Step 1: Find min and max click_timestamp from incoming conversions
        //const timestamps = conversions.map(conv => conv.click_timestamp);
        //const minTimestamp = Math.min(...timestamps);
        //const maxTimestamp = Math.max(...timestamps);


        /*
        // Step 2: Fetch existing conversions from ClickHouse within the timestamp range
        const existingConversions = await this.clickHouseService.query(`
            SELECT session_id, keyword_clicked
            FROM report_conversions
            WHERE (reported = 1 OR valid = 0)
            AND click_timestamp BETWEEN ${minTimestamp} AND ${maxTimestamp}
            GROUP BY session_id, keyword_clicked
        `);

        

        // Step 3: Create a map of conversions that have been successfully reported
        const existingConversionsMap = existingConversions.reduce((map, conversion) => {
            const key = `${conversion.session_id}-${conversion.keyword_clicked}`;
            map[key] = true;
            return map;
        }, {});
        */

        const newConversions = [];        

        // Check each conversion against MongoDB and sort into update/insert lists
        for (const conversion of conversions) {
            // Check if the conversion ID is already in MongoDB
            const existingConversion = await this.mongoRepository.findBySessionIdAndKeywordClicked(
                conversion.session_id, 
                conversion.keyword_clicked
            );

            console.log("Existing conversion: ");
            console.log(existingConversion);

            // Add to appropriate list based on whether it exists
            if (existingConversion) {
                //conversionsToUpdate.push(conversion);
                console.log("Existing conversion found.")
            } else {
                newConversions.push(conversion);
            }
        }
        
        /*
        // Step 4: Include conversions that haven't been successfully reported
        const newConversions = conversions.filter(conversion => {
            const key = `${conversion.session_id}-${conversion.keyword_clicked}`;
            return !existingConversionsMap[key];
        });
        */

        // Step 5: Return the new conversions for processing
        return newConversions;
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
     * Reports conversion data to MongoDB.  
     * @param {Array} conversions - Array of conversion objects to report
     */
    async reportToMongoDB(conversions) {
        ConversionReporterLogger.info('Conversion Reporter: Reporting to MongoDB');

        console.log("Conversions: ");
        console.log(conversions);
       
        const conversionsToUpdate = [];
        const conversionsToInsert = [];

        // Check each conversion against MongoDB and sort into update/insert lists
        for (const conversion of conversions) {
            // Check if the conversion ID is already in MongoDB
            const existingConversion = await this.mongoRepository.findBySessionIdAndKeywordClicked(
                conversion.session_id, 
                conversion.keyword_clicked
            );

            console.log("Existing conversion: ");
            console.log(existingConversion);

            // Add to appropriate list based on whether it exists
            if (existingConversion) {
                conversionsToUpdate.push(conversion);
            } else {
                conversionsToInsert.push(conversion);
            }
        }

        // Add connection management since ?async connections bad?
        this.mongoRepository.initConnection();
        // Updates first
        if (conversionsToUpdate.length > 0) {
            for (const updateConversion of conversionsToUpdate) {
                const updateResult = await this.mongoRepository.updateByQuery({
                    session_id: updateConversion.session_id,
                    keyword_clicked: updateConversion.keyword_clicked
                }, updateConversion).catch(error => {
                    ConversionReporterLogger.error(`Conversion Reporter: Updating for ${updateConversion.session_id} and keyword ${updateConversion.keyword_clicked} failed: ${error.message}`);
                });

                console.log("Update result: ");
                console.log(updateResult);

                ConversionReporterLogger.info(`Conversion Reporter: Updating for ${updateConversion.session_id}-${updateConversion.keyword_clicked} finished`);
            }
        }

        // Inserts the rest
        if (conversionsToInsert.length > 0) {
            for (const insertConversion of conversionsToInsert) {
                const insertResult = await this.mongoRepository.create(insertConversion).catch(error => {
                    ConversionReporterLogger.error(`Conversion Reporter: Inserting for ${insertConversion.session_id} and keyword ${insertConversion.keyword_clicked} failed: ${error.message}`);
                });
                
                console.log("Insert result: ");
                console.log(insertResult);

                ConversionReporterLogger.info(`Conversion Reporter: Inserting for ${insertConversion.session_id}-${insertConversion.keyword_clicked} finished`);
            }
        }

        // End the connection
        this.mongoRepository.endConnection();

    }

    /**
     * Deletes a conversion from MongoDB.
     * @param {Array} conversions - Array of conversion objects to delete
     */
    async deleteFromMongoDB(conversions) {
        ConversionReporterLogger.info('Conversion Reporter: Deleting report conversions from MongoDB');
        
        // Add connection management since ?async connections bad?
        this.mongoRepository.initConnection();

        // Main loop
        for(const conversion of conversions){
            
            const deleteResult = await this.mongoRepository.delete(conversion).catch(error => {
                ConversionReporterLogger.error(`Conversion Reporter: Deleting for tuple (${conversion.session_id}, ${conversion.keyword_clicked}) failed: ${error.message}`);
            });
            
        }

        // End the connection
        this.mongoRepository.endConnection();

        ConversionReporterLogger.info('Conversion Reporter: Deletion process finished');

    }

    /**
     * Reports conversion data to Facebook's API.
     * @param {Array} conversions - Array of conversion objects to report
     * @returns {Promise<Object>} Object containing successes and failures
     */
    async reportToFacebook(conversions, network) {
        ConversionReporterLogger.info('Conversion Reporter: Reporting to Facebook');
        return await this.facebookService.reportConversions(conversions, network);
    }

    /**
     * Reports conversion data to TikTok's API (Not implemented).
     * @param {Array} conversions - Array of conversion objects to report
     */
    async reportToTiktok(conversions) {
    }
}

module.exports = ConversionReporter;