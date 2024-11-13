// Local Application Imports
const S3Service = require("../../shared/lib/S3Service");
const { ConversionReporterLogger } = require("../../shared/lib/WinstonLogger");

function extractS3Key(record) {
    const sourceKey = record.s3.object.key;
    return decodeURIComponent(sourceKey);
}

class ConversionsFilter {

    constructor() {}

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
                const parsedObjects = await S3Service.readDataFromFolder(
                    'interpreted-events-bucket',
                    decodedS3Key
                );
                
                // Step 2.2.1: Interpret the source string
                const [moduleGroup, source, jobKey, accountName, date, hour, filename, received_at] = this.interpretSourceString(decodedS3Key);

                // Step 2.3: Log the parsed objects
                ConversionReporterLogger.info(`✅ Received ${parsedObjects[0].length} objects from S3`);
            };
        } catch (error) {            
            console.error('❌ Error processing queue message:', error);
        }
    }

}

module.exports = ConversionsFilter; 