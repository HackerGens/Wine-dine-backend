const crypto = require('crypto');

// AES configuration
const algorithm = 'aes-192-cbc';
const password = 'defineaPassword'; // Decryption password (same as for encryption)
const key = crypto.scryptSync(password, 'salt', 24); // Generate key using the password

// Function to decrypt a message
function decryptMessage(encryptedMessage) {
  try {
    const [ivBase64, ciphertext] = encryptedMessage.split('.'); // Extract IV and ciphertext
    const iv = Buffer.from(ivBase64, 'base64'); // Decode IV from Base64
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const decryptedMessage = decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
    return decryptedMessage; // Return the decrypted message
  } catch (err) {
    console.error(`Decryption error: ${err.message}`);
    throw new Error('Decryption failed');
  }
}

module.exports = { decryptMessage };
