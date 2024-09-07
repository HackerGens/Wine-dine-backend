const crypto = require('crypto');

// AES configuration
const algorithm = 'aes-192-cbc';
const password = 'defineaPassword'; // Encryption password
const key = crypto.scryptSync(password, 'salt', 24); // Generate key using the password

// Function to encrypt a message
function encryptMessage(message) {
  try {
    const iv = crypto.randomBytes(16); // Generate a random IV for each encryption
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedMessage = cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
    return `${iv.toString('base64')}.${encryptedMessage}`; // Return IV and encrypted message as a string
  } catch (err) {
    console.error(`Encryption error: ${err.message}`);
    throw new Error('Encryption failed');
  }
}

module.exports = { encryptMessage };
