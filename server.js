const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const momentRoutes = require('./routes/moments'); // Import the new moments routes
const activityRouter = require('./routes/activity');

// Import the activity routes
const activityRoutes = require('./routes/activity');
// Other middleware and route imports
const friendsRoute = require('./routes/friends');

require('dotenv').config(); // Load environment variables from .env file

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

const app = express();

app.use(express.urlencoded({ extended: true }));
// Middleware for parsing JSON bodies
app.use(express.json());


// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/moments', momentRoutes); // Use the new routes
app.use('/api/friends', friendsRoute);
app.use('/api', activityRouter);
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
