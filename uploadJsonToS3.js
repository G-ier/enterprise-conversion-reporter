const fs = require('fs');
const path = require('path');
const s3Service = require('./src/shared/lib/S3Service');

async function uploadJsonToS3() {
    try {
        // 1. Read the JSON file
        const defaultFilename = '/testSamples/testFile.json';
        const inputFilename = process.argv[2] || defaultFilename;
        const filePath = path.join(__dirname, inputFilename);
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // 2. Set up the S3 upload parameters
        const accountName = 'RoiADSLLC3';  // Replace with actual account name
        const jobName = 'Crossroads-send-interpreted-data-to-s3';         // Replace with actual job name
        const filename = new Date().toISOString();
        const folderName = `networks/crossroads/${jobName}/${accountName}`;
        const bucketName = 'interpreted-events-bucket';   // Replace with your bucket name
        
        // 3. Upload to S3
        const response = await s3Service.storeDataInFolder(
            bucketName,
            folderName,
            filename,
            jsonData,
            'application/json'
        );

        console.log('✅ Upload successful:', response);
        return response;

    } catch (error) {
        console.error('❌ Error uploading file:', error);
        throw error;
    }
}

// Add usage instructions if no file is provided
if (process.argv.length < 3) {
    console.log('No filename provided, using default: testFile.json');
    console.log('Usage: node uploadJsonToS3.js <filename>');
}

// Execute the function
uploadJsonToS3();