// scheduler.js
const cron = require('node-cron');
const Message = require('./models/Message'); // Adjust the path as necessary
const { decryptMessage, broadcast } = require('./utils'); // Ensure these functions are imported correctly

// Schedule a job to run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // Fetch scheduled messages that need to be sent
    const scheduledMessages = await Message.find({
      scheduledAt: { $lte: now }, // Get messages where scheduledAt is less than or equal to now
      sent: false, // Assuming you have a 'sent' field to track if the message has been sent
    });

    for (const message of scheduledMessages) {
      // Decrypt the message text if it's encrypted
      if (message.text) {
        message.text = decryptMessage(message.text, message.sender.publicKey);
      }

      // Send the message (you may need to adjust how you send it)
      await sendMessage(message);

      // Update the message to mark it as sent
      message.sent = true; // Mark as sent
      await message.save();

      // You may want to broadcast the message via WebSocket here
      broadcast({
        type: 'message',
        senderId: message.sender,
        receiverId: message.recipient,
        text: message.text,
        imageUrl: message.imageUrl,
        emoji: message.emoji,
      });
    }
  } catch (err) {
    console.error('Error in scheduled message job:', err.message);
  }
});

// Function to send the message (implement this as needed)
async function sendMessage(message) {
  // Logic to send the message, e.g., via WebSocket or store in the database
  console.log(`Sending scheduled message to ${message.recipient}: ${message.text}`);
}

