// Скрипт для создания тестового пользователя
// Использование: node create-user.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createUser() {
  try {
    // Подключение к MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/maxcord';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Данные пользователя (можно изменить)
    const username = process.argv[2] || 'testuser';
    const email = process.argv[3] || 'test@example.com';
    const password = process.argv[4] || 'test123';

    console.log('Creating user with:', { username, email, password: '***' });

    // Проверка существования пользователя
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('User already exists:', {
        id: existingUser._id,
        username: existingUser.username,
        email: existingUser.email
      });
      await mongoose.disconnect();
      process.exit(0);
    }

    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Создание пользователя
    const user = new User({
      username,
      email,
      password: hashedPassword,
      status: 'offline'
    });

    await user.save();
    console.log('User created successfully:', {
      id: user._id,
      username: user.username,
      email: user.email
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createUser();

