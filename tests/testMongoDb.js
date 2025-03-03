const ConversionReporter = require('../src/modules/conversionReporter/ConversionReporter');
const { v4: uuidv4 } = require('uuid');

async function main() {
    try {
        const conversionReporter = new ConversionReporter();
        // Report 2 test conversion to MongoDB
        await conversionReporter.reportToMongoDB([{session_id:`${uuidv4()}`, keyword_clicked: `${uuidv4()}`, click_timestamp: 1714761600000}, {session_id: `${uuidv4()}`, keyword_clicked: `${uuidv4()}`, click_timestamp: 1714761600000}]);
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