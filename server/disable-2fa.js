const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function disable2FA() {
  const username = process.argv[2];
  if (!username) {
    console.error('Please provide a username: node disable-2fa.js <username>');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/maxcord';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ username });
    if (!user) {
      console.error(`User not found: ${username}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    user.is2FAEnabled = false;
    await user.save();

    console.log(`2FA disabled for user: ${username}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

disable2FA();
