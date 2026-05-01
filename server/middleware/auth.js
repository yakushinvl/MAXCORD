const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    let user;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId).select('-password');
    } catch (jwtError) {
      if (token.startsWith('bot_')) {
        user = await User.findOne({ botToken: token, isBot: true }).select('-password');
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Check ban
    if (user.isBanned) {
      if (user.banExpires && user.banExpires < Date.now()) {
        user.isBanned = false;
        user.banExpires = undefined;
        user.banReason = undefined;
        await user.save();
      } else {
        const expiresMsg = user.banExpires ? ` до ${new Date(user.banExpires).toLocaleString()}` : ' НАВСЕГДА';
        return res.status(403).json({
          message: `Ваш аккаунт заблокирован${expiresMsg}. Причина: ${user.banReason || 'Не указана'}`,
          isBanned: true,
          banReason: user.banReason,
          banExpires: user.banExpires
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;










