const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

class DynamoDBService {

  static instance = null;

  static getInstance() {
    if (!DynamoDBService.instance) {
      DynamoDBService.instance = new DynamoDBService();
    }
    return DynamoDBService.instance;
  }

  constructor() {
    const dbClient = new DynamoDBClient({ region: "us-east-1" });
    this.docClient = DynamoDBDocumentClient.from(dbClient);
  }

  async queryItems(tableName, queryParams) {
    const params = {
      TableName: tableName,
      ...queryParams
    };

    try {
      const data = await this.docClient.send(new QueryCommand(params));
      return data.Items;
    } catch (error) {
      console.error("Error querying items by partition key:", error);
    }
  }

  async scanItems(tableName) {
    const params = {
      TableName: tableName,
    };

    try {
      const data = await this.docClient.send(new ScanCommand(params));
      return data.Items;
    } catch (error) {
      console.error("Error scanning items:", error);
    }
  }

}

const dynamoDBService = DynamoDBService.getInstance();
module.exports = dynamoDBService;
