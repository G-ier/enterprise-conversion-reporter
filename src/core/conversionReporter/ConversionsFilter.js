// Local Application Imports
const S3Service = require("../../shared/lib/S3Service");
const DynamoDbService = require("../../shared/lib/DynamoDBService");
const { ConversionReporterLogger } = require("../../shared/lib/WinstonLogger");

function extractS3Key(record) {
    const sourceKey = record.s3.object.key;
    return decodeURIComponent(sourceKey);
}

class ConversionsFilter {

    constructor() {}

    async filterConversions(parsedObjects) {

        const subscribedCampaigns = await DynamoDbService.scanItems('conversion-reporting-subscriptions');
        const subscribedCampaignIds = subscribedCampaigns.map(campaign => campaign.id);
        ConversionReporterLogger.info(`✅ Found ${subscribedCampaignIds.length} subscribed campaigns: ${subscribedCampaignIds}`);
        return parsedObjects.filter(object => subscribedCampaignIds.includes(object.campaign_id));
    }

    interpretSourceString(sourceString) {
        const [moduleGroup, source, jobKey, accountName, date, hour, filename] = sourceString.split("/");
        const received_at = filename.split(".")[0];
        ConversionReporterLogger.info(`Message Received:

        ----------------------------------------------------
        Module Group: ${moduleGroup}
        Source: ${source}
        Job Key: ${jobKey}
        Account Name: ${accountName}
        Filename: ${filename}
        Received At: ${received_at}
        ----------------------------------------------------

        `);
        return [moduleGroup, source, jobKey, accountName, date, hour, filename, received_at];
    }

    async uploadFilteredData(filteredObjects, sourceInfo, targetBucket) {
        try {
            const { accountName, jobKey } = sourceInfo;
            const filename = new Date().toISOString();
            const folderName = `filtered-conversions/${jobKey}/${accountName}`;

            const response = await S3Service.storeDataInFolder(
                targetBucket,
                folderName,
                filename,
                filteredObjects,
                'application/json'
            );

            ConversionReporterLogger.info(`✅ Successfully uploaded filtered data to S3: ${JSON.stringify(response, null, 2)}`);
            return response;
        } catch (error) {
            ConversionReporterLogger.error('❌ Error uploading filtered data:', error);
            throw error;
        }
    }

    async processQueueMessage(message) {

        try{
            // Step 1: Parse the message body
            const body = JSON.parse(message.Body);

            // Step 2: Process each data in the message
            for (const record of body.Records) {
                
                // Step 2.1: Extract the S3 key from the record
                const decodedS3Key = extractS3Key(record);
                ConversionReporterLogger.info(`✅ Decoded S3 key: ${decodedS3Key}`);

                // Step 2.2: Read the data from S3 & parse it to a list.
                const parsedObjectsList = await S3Service.readDataFromFolder(
                    'interpreted-events-bucket',
                    decodedS3Key
                );
                const parsedObjects = parsedObjectsList[0];

                // Step 2.3: Interpret the source string
                const [moduleGroup, source, jobKey, accountName, date, hour, filename, received_at] = this.interpretSourceString(decodedS3Key);

                // Step 2.4: Log the parsed objects
                ConversionReporterLogger.info(`✅ Received ${parsedObjects.length} objects from S3`);

                // Step 3: Filter the parsed objects
                const filteredObjects = await this.filterConversions(parsedObjects);

                // Step 3.1: Log the filtered objects
                ConversionReporterLogger.info(`✅ Filtered ${filteredObjects.length} objects from S3`);

                // Step 4: Upload filtered data to S3
                if (filteredObjects.length > 0) {
                    await this.uploadFilteredData(
                        filteredObjects,
                        { accountName, jobKey },
                        'report-conversions-bucket'  // Replace this with your desired bucket name
                    );
                }

            };
        } catch (error) {            
            console.error('❌ Error processing queue message:', error);
        }
    }

}

module.exports = ConversionsFilter; 