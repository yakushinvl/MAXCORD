const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Пароль должен содержать минимум 8 символов')
    .matches(/^[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/)
    .withMessage('Пароль содержит недопустимые символы')
    .matches(/[A-Z]/)
    .withMessage('Пароль должен содержать хотя бы одну заглавную букву')
    .matches(/[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Пароль должен содержать хотя бы одну цифру или специальный символ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, email, password } = req.body;

    let user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const verificationToken = crypto.randomBytes(32).toString('hex');

    user = new User({
      username,
      email: email.toLowerCase(),
      password,
      isVerified: true, // Verification disabled
      verificationToken: null
    });

    await user.save();

    /* Verification email disabled
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (mailError) {
      console.error('Failed to send verification email:', mailError);
    }
    */

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Регистрация успешна.',
      token,
      user: { id: user._id, username: user.username, email: user.email, status: user.status }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', [
  body('email').exists().withMessage('Email or Username is required'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    console.log('[Login] Attempting login for:', email);

    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email }
      ]
    });

    if (!user) {
      console.log('[Login] User not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[Login] Comparing password for user:', user.username);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('[Login] Password mismatch');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verification and 2FA disabled - returning token immediately
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    user.status = user.statusPreference || 'online';
    await user.save();

    return res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, status: user.status }
    });
  } catch (error) {
    console.error('[Login] CRITICAL ERROR:', error.message);
    res.status(500).json({
      message: 'Server error',
      details: error.message,
      stack: error.stack
    });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('servers');
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

