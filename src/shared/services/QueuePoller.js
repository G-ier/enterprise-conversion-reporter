
class QueuePoller {

    constructor(sqsService, messageProcessingCallback) {
      this.sqsService = sqsService;
      this.messageProcessingCallback = messageProcessingCallback;
    }
  
    async poll() {
  
        while (true) {
            try {
                const messages = await this.sqsService.receiveMessages();
                if (messages.Messages && messages.Messages.length > 0) {
                    for (const message of messages.Messages) {
                    await this.messageProcessingCallback(message);
                    // After processing, delete the message from the queue
                    await this.sqsService.deleteMessage(message.ReceiptHandle);
                    }
                }
            } 
            catch (error) {
                console.error("An error occurred while polling the queue:", error);
            }
      }
    }
}
  
module.exports = QueuePoller;
