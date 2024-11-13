const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

class S3Service {

  constructor() {
    if (!S3Service.instance) {
      this.s3Client = new S3Client({ region: "us-east-1" }); // Initialize the S3 client here
      S3Service.instance = this;
    }
    return S3Service.instance;
  }

  toS3DTO(folderName, filename, data) {
    return {
      folderName,
      filename,
      data,
    };
  }

  async storeDataInFolder(bucketName, folderName, filename, data, contentType='application/octet-stream') {

    const timestamp = new Date();
    const year = timestamp.getUTCFullYear();
    const month = timestamp.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
    const day = timestamp.getUTCDate();
    const hour = timestamp.getUTCHours();
    const dataSeggregationExtension = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}/${hour}`;

    console.log('✅ Folder name:', folderName);
    console.log('✅ Final Key:', `${folderName}/${dataSeggregationExtension}/${filename}.json`);
    console.log('✅ Content type:', contentType);

    let params;
    if(contentType === 'image/png'){
      params = {
        Bucket: bucketName,
        Key: `${folderName}/${dataSeggregationExtension}/${filename}.png`,
        Body: data,
        ContentType: 'image/png',
      };
    } else if (contentType === 'application/json' || typeof data === 'object') {
      params = {
        Bucket: bucketName,
        Key: `${folderName}/${dataSeggregationExtension}/${filename}.json`,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      };
    } else {
      params = {
        Bucket: bucketName,
        Key: `${folderName}/${dataSeggregationExtension}/${filename}`,
        Body: data,
        ContentType: contentType,
      };
    }

    try {
      const command = new PutObjectCommand(params);
      const response = await this.s3Client.send(command);
      return response;
    } catch (error) {
      console.error(`❌ Error storing data in S3: ${error}`);
    }
  }

  async parseToJson(body) {
    const bodyStr = await body.transformToString();
    const parsedObjects = JSON.parse(bodyStr);
    return parsedObjects;
  }

  async readDataFromFolder(bucketName, S3Key, parseToJson = true) {
    const params = {
      Bucket: bucketName,
      Key: S3Key,
    };

    try {
      const command = new GetObjectCommand(params);
      const response = await this.s3Client.send(command);
      if (!parseToJson) return response;
      return await this.parseToJson(response.Body);
    } catch (error) {
      console.error(`❌ Error reading data from S3: ${error}`);
    }
  }
}

const instance = new S3Service();
Object.freeze(instance);

module.exports = instance;
