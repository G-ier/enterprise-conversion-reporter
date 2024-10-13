// Third Party Imports
const {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    SendMessageCommand
} = require("@aws-sdk/client-sqs");

class SqsService {
  
    constructor(queueUrl, region = "us-east-1") {
      this.queueUrl = queueUrl;
      this.sqsClient = new SQSClient({ region });
    }
  
    async sendMessageToQueue(event) {
      const params = {
        MessageBody: JSON.stringify(event),
        QueueUrl: this.queueUrl,
      };
  
      try {
        const data = await this.sqsClient.send(new SendMessageCommand(params));
        console.log(`Message sent to SQS queue: ${data.MessageId}`);
      } catch (error) {
        console.error(`❌ Error sending message to SQS queue: ${error}`);
      }
    }
  
    async receiveMessages(maxNumberOfMessages = 5, waitTimeSeconds = 10) {
      const receiveParams = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxNumberOfMessages,
        WaitTimeSeconds: waitTimeSeconds,
      };
      return this.sqsClient.send(new ReceiveMessageCommand(receiveParams));
    }
  
    async deleteMessage(receiptHandle) {
      const deleteParams = {
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      };
      return this.sqsClient.send(new DeleteMessageCommand(deleteParams));
    }
  
  }
  
  module.exports = SqsService;
  