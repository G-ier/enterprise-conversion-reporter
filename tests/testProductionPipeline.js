const ConversionReporter = require('../src/modules/conversionReporter/ConversionReporter');
const { v4: uuidv4 } = require('uuid');

// Test modes
const TEST_MODES = {
    PRODUCE_TEST_DATA_WITH_UPDATE: 'produce_test_data_with_update',
    PRODUCE_TEST_DATA_NO_UPDATE: 'produce_test_data_no_update',
    MOCK_SQS_MESSAGE: 'mock_sqs_message',
    MOCK_SQS_MESSAGE_WITH_MULTIPLE_CONVERSIONS: 'mock_sqs_message_with_multiple_conversions',
    MOCK_SQS_MESSAGE_WITH_MULTIPLE_UPDATES: 'mock_sqs_message_with_multiple_updates',
    ERROR_TEST: 'error'
};

// Generate test data
function generateTestData(mode) {
    switch (mode) {
        case TEST_MODES.MOCK_SQS_MESSAGE:
            return {
                "Body": "{\"Records\": [{ \"s3\": { \"object\": { \"key\": \"test-conversions/airfind/Airfind-Todays-Interpreted-Data-To-S3/m@roi.ad/MONITORING_TEST_1.json\" } } }]}"
            };
        case TEST_MODES.MOCK_SQS_MESSAGE_WITH_MULTIPLE_CONVERSIONS:
            return {
                "Body": "{\"Records\": [{ \"s3\": { \"object\": { \"key\": \"test-conversions/airfind/Airfind-Todays-Interpreted-Data-To-S3/m@roi.ad/MONITORING_TEST_2.json\" } } }]}"
            };
        case TEST_MODES.MOCK_SQS_MESSAGE_WITH_MULTIPLE_UPDATES:
            return {
                "Body": "{\"Records\": [{ \"s3\": { \"object\": { \"key\": \"test-conversions/airfind/Airfind-Todays-Interpreted-Data-To-S3/m@roi.ad/MONITORING_TEST_3.json\" } } }]}"
            };
        default:
            throw new Error(`Invalid test mode: ${mode}`);
    }
}

async function main() {
    try {
        // Get test mode from command line arguments
        const testMode = process.argv[2] || TEST_MODES.ERROR_TEST;

        if(testMode === TEST_MODES.PRODUCE_TEST_DATA_WITH_UPDATE) {
            // Generate test data with unique session IDs
            const testData = [
                {
                    "date_hour": "2025-02-01T13:00:00",
                    "click_timestamp": 1738417713,
                    "network": "airfind", 
                    "nw_account_id": 1,
                    "nw_account_name": "ROIAdsLLC2",
                    "nw_campaign_id": "624693",
                    "nw_campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01",
                    "crossroads_campaign_type": "Publisher Created",
                    "crossroads_campaign_number": "",
                    "category": "",
                    "domain_name": "vivivivienda.today",
                    "pixel_id": "256065860191102",
                    "campaign_id": "120218982145500212",
                    "campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01 -N.C",
                    "adset_name": "",
                    "adset_id": "120218982145580212",
                    "ad_id": "120218982145630212",
                    "traffic_source": "facebook",
                    "session_id": "06410aba-18f6-4fe8-8159-b66bce2788a8",
                    "ip": "2806:2a0:444:83ce:ecd6:8fda:c936:16d0",
                    "country_code": "MX",
                    "region": "MexicoCity", 
                    "city": "Iztapalapa",
                    "ts_click_id": "IwZXh0bgNhZW0BMABhZGlkAasbUYd8lpQBHZcdlHZrCsZB1bKAfQAwOGL4EJx8gEWn2SCppzFvfyQ4Exdhxj1dgQURRA_aem_qssch1B_XQ5JrNUtSGbaCw",
                    "user_agent": "Mozilla/5.0 (Linux; Android 12; moto g(30) Build/S0RCS32.41-10-19-14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.156 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/498.0.0.54.74;IABMV/1;]",
                    "keyword_clicked": "Quiero Comprar un Departamento Sin Enganche Pagando Mensual",
                    "visits": 1,
                    "serp": 1,
                    "conversions": 1,
                    "revenue": 0.09,
                    "unique_identifier": `${uuidv4()}-Quiero Comprar un Departamento Sin Enganche Pagando Mensual`
                },
                {
                    "date_hour": "2025-02-01T13:00:00",
                    "click_timestamp": 1738417713,
                    "network": "airfind",
                    "nw_account_id": 1,
                    "nw_account_name": "ROIAdsLLC2", 
                    "nw_campaign_id": "624694",
                    "nw_campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-26",
                    "crossroads_campaign_type": "Publisher Created",
                    "crossroads_campaign_number": "",
                    "category": "",
                    "domain_name": "vivivivienda.today",
                    "pixel_id": "256065860191102",
                    "campaign_id": "120218982145500212",
                    "campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01 -N.C",
                    "adset_name": "",
                    "adset_id": "120218982145580212",
                    "ad_id": "120218982145630212",
                    "traffic_source": "facebook",
                    "session_id": uuidv4(),
                    "ip": "2806:2a0:444:83ce:ecd6:8fda:c936:16d0",
                    "country_code": "MX",
                    "region": "middleEast",
                    "city": "Kabul",
                    "ts_click_id": "IwZXh0bgNhZW0BMABhZGlkAasbUYd8lpQBHZcdlHZrCsZB1bKAfQAwOGL4EJx8gEWn2SCppzFvfyQ4Exdhxj1dgQURRA_aem_qssch1B_XQ5JrNUtSGbaCw",
                    "user_agent": "Mozilla/5.0 (Linux; Android 12; moto g(30) Build/S0RCS32.41-10-19-14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.156 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/498.0.0.54.74;IABMV/1;]",
                    "keyword_clicked": "Quiero Comprar un Departamento Sin Enganche Pagando Mensual",
                    "visits": 1,
                    "serp": 1,
                    "conversions": 1,
                    "revenue": 0.09,
                    "unique_identifier": `${uuidv4()}-Topestrafulla`
                }
            ];
            console.log(testData);
            process.exit(0);
        }
                    

        if (testMode === TEST_MODES.PRODUCE_TEST_DATA_NO_UPDATE) {
            // Generate test data with unique session IDs
            const testData = [
                {
                    "date_hour": "2025-02-01T13:00:00",
                    "click_timestamp": 1738417713,
                    "network": "airfind", 
                    "nw_account_id": 1,
                    "nw_account_name": "ROIAdsLLC2",
                    "nw_campaign_id": "624693",
                    "nw_campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01",
                    "crossroads_campaign_type": "Publisher Created",
                    "crossroads_campaign_number": "",
                    "category": "",
                    "domain_name": "vivivivienda.today",
                    "pixel_id": "256065860191102",
                    "campaign_id": "120218982145500212",
                    "campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01 -N.C",
                    "adset_name": "",
                    "adset_id": "120218982145580212",
                    "ad_id": "120218982145630212",
                    "traffic_source": "facebook",
                    "session_id": uuidv4(),
                    "ip": "2806:2a0:444:83ce:ecd6:8fda:c936:16d0",
                    "country_code": "MX",
                    "region": "MexicoCity", 
                    "city": "Iztapalapa",
                    "ts_click_id": "IwZXh0bgNhZW0BMABhZGlkAasbUYd8lpQBHZcdlHZrCsZB1bKAfQAwOGL4EJx8gEWn2SCppzFvfyQ4Exdhxj1dgQURRA_aem_qssch1B_XQ5JrNUtSGbaCw",
                    "user_agent": "Mozilla/5.0 (Linux; Android 12; moto g(30) Build/S0RCS32.41-10-19-14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.156 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/498.0.0.54.74;IABMV/1;]",
                    "keyword_clicked": "Quiero Comprar un Departamento Sin Enganche Pagando Mensual",
                    "visits": 1,
                    "serp": 1,
                    "conversions": 1,
                    "revenue": 0.09,
                    "unique_identifier": `${uuidv4()}-Quiero Comprar un Departamento Sin Enganche Pagando Mensual`
                },
                {
                    "date_hour": "2025-02-01T13:00:00",
                    "click_timestamp": 1738417713,
                    "network": "airfind",
                    "nw_account_id": 1,
                    "nw_account_name": "ROIAdsLLC2", 
                    "nw_campaign_id": "624694",
                    "nw_campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-26",
                    "crossroads_campaign_type": "Publisher Created",
                    "crossroads_campaign_number": "",
                    "category": "",
                    "domain_name": "vivivivienda.today",
                    "pixel_id": "256065860191102",
                    "campaign_id": "120218982145500212",
                    "campaign_name": "002_FB_ApartmentIninstallement_MX_ES_AccountLabel_FN6754-PST50_DAGlobal2024_Test_2025-01-01 -N.C",
                    "adset_name": "",
                    "adset_id": "120218982145580212",
                    "ad_id": "120218982145630212",
                    "traffic_source": "facebook",
                    "session_id": uuidv4(),
                    "ip": "2806:2a0:444:83ce:ecd6:8fda:c936:16d0",
                    "country_code": "MX",
                    "region": "middleEast",
                    "city": "Kabul",
                    "ts_click_id": "IwZXh0bgNhZW0BMABhZGlkAasbUYd8lpQBHZcdlHZrCsZB1bKAfQAwOGL4EJx8gEWn2SCppzFvfyQ4Exdhxj1dgQURRA_aem_qssch1B_XQ5JrNUtSGbaCw",
                    "user_agent": "Mozilla/5.0 (Linux; Android 12; moto g(30) Build/S0RCS32.41-10-19-14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.156 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/498.0.0.54.74;IABMV/1;]",
                    "keyword_clicked": "Quiero Comprar un Departamento Sin Enganche Pagando Mensual",
                    "visits": 1,
                    "serp": 1,
                    "conversions": 1,
                    "revenue": 0.09,
                    "unique_identifier": `${uuidv4()}-Topestrafulla`
                }
            ];
            console.log(testData);
            process.exit(0);
        }
        
        if (!Object.values(TEST_MODES).includes(testMode)) {
            console.error('Invalid test mode. Available modes:', Object.values(TEST_MODES).join(', '));
            process.exit(1);
        }

        console.log(`Running test in mode: ${testMode}`);
        const conversionReporter = new ConversionReporter();
        const testData = generateTestData(testMode);

        // Report conversion to MongoDB
        await conversionReporter.processQueueMessage(testData);
        
    } catch (error) {
        console.error('Error reporting conversion:', error);
        process.exit(1);
    } finally {
        console.log('Successfully ran the testing pipeline.');

    }
}

// Execute the main function
main().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});