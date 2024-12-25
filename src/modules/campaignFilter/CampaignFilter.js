const S3Service = require("../../shared/lib/S3Service");
const DynamoDbService = require("../../shared/lib/DynamoDBService");
const { ConversionReporterLogger } = require("../../shared/utils/logger");
const { parseSourceString } = require("./utils/sourceParser");
const { MetricsCollector, OperationTracker } = require("../../shared/utils/monitoring");

class CampaignFilter {

    constructor() {
        this.metrics = new MetricsCollector('CampaignFilter');
        this.operationTracker = new OperationTracker(this.metrics, 'campaignFiltering');
    }

    async filterSubscribedCampaigns(parsedObjects) {
        const timer = this.metrics.startTimer('filterSubscribedCampaigns');
        try {
            const subscribedCampaigns = await DynamoDbService.scanItems('conversion-reporting-subscriptions');
            this.metrics.recordBatchSize(subscribedCampaigns.length);
            
            const subscribedCampaignIds = subscribedCampaigns.map(campaign => campaign.id);
            const filteredObjects = parsedObjects.filter(object => subscribedCampaignIds.includes(object.campaign_id));
            
            this.metrics.recordConversionCount(parsedObjects.length, 'received');
            this.metrics.recordConversionCount(filteredObjects.length, 'filtered');
            
            ConversionReporterLogger.info(`✅ Found ${subscribedCampaignIds.length} subscribed campaigns`);
            return filteredObjects;
        } finally {
            timer.end();
        }
    }

    async processQueueMessage(message) {
        return this.operationTracker.track(async () => {
            try {
                const body = JSON.parse(message.Body);
                
                let totalProcessed = 0;
                let totalFiltered = 0;

                for (const record of body.Records) {
                    const processTimer = this.metrics.startTimer('processRecord');
                    try {
                        const decodedS3Key = decodeURIComponent(record.s3.object.key);
                        const sourceInfo = parseSourceString(decodedS3Key);
                        
                        const parsedObjects = await this.readAndParseData(decodedS3Key);
                        totalProcessed += parsedObjects.length;

                        const filteredObjects = await this.filterSubscribedCampaigns(parsedObjects);
                        totalFiltered += filteredObjects.length;
                        
                        if (filteredObjects.length > 0) {
                            await this.uploadFilteredData(filteredObjects, sourceInfo);
                        }
                    } finally {
                        processTimer.end();
                    }
                }

                this.metrics.putMetric('TotalRecordsProcessed', totalProcessed, 'Count');
                this.metrics.putMetric('TotalRecordsFiltered', totalFiltered, 'Count');
                this.metrics.putMetric('FilteringRatio', (totalFiltered / totalProcessed) * 100, 'Percent');

            } catch (error) {            
                this.metrics.recordProcessingErrors();
                ConversionReporterLogger.error(`❌ Error processing message: ${error}`);
                throw error;
            }
        });
    }

    async readAndParseData(s3Key) {
        const timer = this.metrics.startTimer('readAndParseData');
        try {
            const parsedObjectsList = await S3Service.readDataFromFolder(
                'interpreted-events-bucket',
                s3Key
            );
            return parsedObjectsList;
        } finally {
            timer.end();
        }
    }

    async uploadFilteredData(filteredObjects, sourceInfo) {
        const timer = this.metrics.startTimer('uploadFilteredData');
        try {
            const { accountName, jobKey, source } = sourceInfo;
            const filename = new Date().toISOString();
            const folderName = `filtered-conversions/${source}/${jobKey}/${accountName}`;

            return await S3Service.storeDataInFolder(
                'report-conversions-bucket',
                folderName,
                filename,
                filteredObjects,
                'application/json'
            );
        } finally {
            timer.end();
        }
    }
}

module.exports = CampaignFilter;