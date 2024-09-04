const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');

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
app.use('/api/messenger', require('./routes/messenger'));

// Create an HTTP server instance
const server = http.createServer(app);

// Set up WebSocket server using the HTTP server instance
const wss = new WebSocket.Server({ server });

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    console.log('Received message:', message);
    // Handle incoming messages here
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast function to be used in routes
const broadcast = (data, userId) => {
  wss.clients.forEach(client => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { server, broadcast }; // Ensure both are exported
