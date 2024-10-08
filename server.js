const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const { setWebSocketServer } = require('./utils/broadcast'); // Import the broadcast utility

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/moments', require('./routes/moments'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api', require('./routes/activity'));
app.use('/api/messenger', require('./routes/messenger')); // Messenger route

// Create an HTTP server instance
const server = http.createServer(app);

// Set up WebSocket server using the HTTP server instance
const wss = new WebSocket.Server({ server });

// Set the WebSocket server for broadcasting
setWebSocketServer(wss); // Call this to set the WebSocket server

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Handle incoming messages (if needed)
  ws.on('message', (message) => {
    console.log('Received message:', message);
  });

  // Handle WebSocket closure
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Optionally, attach user info to WebSocket if needed
  ws.userId = null; // Initialize it, later can assign userId dynamically on connection
});

// Broadcast function to be used in the routes
const broadcast = (data, userId) => {
  wss.clients.forEach((client) => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Export server and broadcast function for use in other modules
module.exports = { server, broadcast };

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
