const ConversionReporter = require('../src/modules/conversionReporter/ConversionReporter');
const { v4: uuidv4 } = require('uuid');

// Test modes
const TEST_MODES = {
    SINGLE_CONVERSION: 'single',
    MULTIPLE_CONVERSIONS: 'multiple',
    SINGLE_CONVERSION_EXISTS: 'single_exists',
    MULTIPLE_CONVERSIONS_ONE_EXISTS: 'multiple_one_exists',
    MULTIPLE_CONVERSIONS_ALL_EXISTS: 'multiple_all_exists',
    ERROR_TEST: 'error'
};

// Generate test data
function generateTestData(mode) {
    switch (mode) {
        case TEST_MODES.SINGLE_CONVERSION:
            return [{
                session_id: `${uuidv4()}`,
                keyword_clicked: `${uuidv4()}`,
                data: `${uuidv4()}`,
                click_timestamp: 1714761600000
            }];
        case TEST_MODES.MULTIPLE_CONVERSIONS:
            return [
                {
                    session_id: `${uuidv4()}`,
                    keyword_clicked: `${uuidv4()}`,
                    data: `${uuidv4()}`,
                    click_timestamp: 1714761600000
                },
                {
                    session_id: `${uuidv4()}`,
                    keyword_clicked: `${uuidv4()}`,
                    data: `${uuidv4()}`,
                    click_timestamp: 1714761600000
                }
            ];
        case TEST_MODES.ERROR_TEST:
            return [{
                // Invalid data to test error handling
                session_id: null,
                keyword_clicked: undefined,
                data: null,
                click_timestamp: 'invalid'
            }];
        case TEST_MODES.SINGLE_CONVERSION_EXISTS:
            return [{
                session_id: `8sc8234mkda9148`,
                keyword_clicked: `testing`,
                data: `${uuidv4()} - updated`,
                click_timestamp: 1714761600000
            }];     
        case TEST_MODES.MULTIPLE_CONVERSIONS_ONE_EXISTS:
            return [
                {
                    session_id: `8sc8234mkda9148`,
                    keyword_clicked: `testing`,
                    data: `${uuidv4()} - updated`,
                    click_timestamp: 1714761600000
                },
                {
                    session_id: `${uuidv4()}`,
                    keyword_clicked: `${uuidv4()}`,
                    data: `${uuidv4()} - init insert`,
                    click_timestamp: 1714761600000
                }
            ];  
        case TEST_MODES.MULTIPLE_CONVERSIONS_ALL_EXISTS:
            return [
                {
                    session_id: `8sc8234mkda9148`,
                    keyword_clicked: `testing`, 
                    data: `${uuidv4()} - updated`,
                    click_timestamp: 1714761600000
                },
                {
                    session_id: `fc5a9f1a-2269-48dc-8452-605fc9e3e113`,
                    keyword_clicked: `ae09ee62-b87e-4b2f-ad35-55a5e528b9b6`, 
                    data: `${uuidv4()} - updated`,
                    click_timestamp: 1714761600000
                }
            ];  
        default:
            throw new Error(`Invalid test mode: ${mode}`);
    }
}

async function main() {
    try {
        // Get test mode from command line arguments
        const testMode = process.argv[2] || TEST_MODES.SINGLE_CONVERSION;
        
        if (!Object.values(TEST_MODES).includes(testMode)) {
            console.error('Invalid test mode. Available modes:', Object.values(TEST_MODES).join(', '));
            process.exit(1);
        }

        console.log(`Running test in mode: ${testMode}`);
        const conversionReporter = new ConversionReporter();
        const testData = generateTestData(testMode);

        // Report conversion to MongoDB
        await conversionReporter.reportToMongoDB(testData);
        console.log('Successfully reported conversion to MongoDB');
    } catch (error) {
        console.error('Error reporting conversion:', error);
        process.exit(1);
    }
}

// Execute the main function
main().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});