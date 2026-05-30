const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const { body, validationResult } = require('express-validator');

// Middleware to check for moderator/admin roles
const isModerator = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (user && (user.role === 'moderator' || user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Доступ запрещен' });
  }
};

const isAdmin = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (user && user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Требуются права администратора' });
  }
};

// Create a report — target can be a user (incl. bot) or a mini-app.
router.post('/report', auth, [
  body('reason').notEmpty().withMessage('Reason is required'),
], async (req, res) => {
  try {
    const { userId, miniAppId, reason, description, messageId } = req.body;
    if (!userId && !miniAppId) return res.status(400).json({ message: 'Нужно указать userId или miniAppId' });
    const report = new Report({
      reporter: req.user._id,
      reportedUser: userId || null,
      reportedMiniApp: miniAppId || null,
      reason,
      description,
      messageContext: messageId || null
    });
    await report.save();
    res.status(201).json({ message: 'Жалоба успешно отправлена' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get reports (Moderator only)
router.get('/reports', [auth, isModerator], async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: 'pending' };
    
    const reports = await Report.find(query)
      .populate('reporter', 'username avatar')
      .populate('reportedUser', 'username avatar')
      .populate('reportedMiniApp', 'name avatar')
      .populate('resolvedBy', 'username')
      .populate('messageContext')
      .sort('-createdAt');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Resolve report (Moderator only)
router.post('/reports/:id/resolve', [auth, isModerator], async (req, res) => {
  try {
    const { status, note } = req.body;
    const report = await Report.findByIdAndUpdate(req.params.id, {
      status,
      resolvedBy: req.user._id,
      resolutionNote: note
    }, { new: true }).populate('reportedUser').populate('reporter');
    
    // Notify the offender if resolved (meaning a violation was confirmed)
    if (status === 'resolved' && report.reportedUser) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${report.reportedUser._id}`).emit('notification', {
          type: 'moderation_violation',
          message: `На ваш аккаунт поступила жалоба, которая была одобрена модератором: ${note}`,
          reason: report.reason,
          timestamp: new Date()
        });
      }
    }
    
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Ban user (Moderator only)
router.post('/ban', [auth, isModerator], async (req, res) => {
  try {
    const { userId, type, reason, durationHours } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    
    // Admins cannot be banned by moderators
    const modUser = await User.findById(req.user._id);
    if (user.role === 'admin' && modUser.role !== 'admin') {
      return res.status(403).json({ message: 'Вы не можете забанить администратора' });
    }

    user.isBanned = true;
    user.banReason = reason;
    if (type === 'temporary' && durationHours) {
      user.banExpires = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    } else {
      user.banExpires = null; // Permanent
    }
    
    await user.save();
    
    // Notify user of their ban status immediately via socket
    const io = req.app.get('io');
    if (io) {
      const expiresMsg = user.banExpires ? ` до ${new Date(user.banExpires).toLocaleString()}` : ' НАВСЕГДА';
      io.to(`user-${user._id}`).emit('account-banned', {
        type,
        reason,
        expires: user.banExpires,
        message: `Ваш аккаунт заблокирован${expiresMsg}. Причина: ${reason}`
      });
    }

    res.json({ message: 'Пользователь успешно забанен' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Assign roles (Admin only)
router.post('/assign-role', [auth, isAdmin], async (req, res) => {
  try {
    const { userId, role } = req.body;
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    res.json({ message: `Роль ${role} успешно назначена пользователю ${user.username}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Unban user (Moderator only)
router.post('/unban', [auth, isModerator], async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    user.isBanned = false;
    user.banExpires = undefined;
    user.banReason = undefined;
    await user.save();

    res.json({ message: 'Пользователь успешно разбанен' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Unresolve report (Moderator only)
router.post('/reports/:id/unresolve', [auth, isModerator], async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, {
      status: 'pending',
      resolvedBy: null,
      resolutionNote: null
    }, { new: true });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// === Marketplace moderation: bots & mini-apps =============================
const MiniApp = require('../models/MiniApp');

// List all pending publication requests + currently approved (for blocking).
router.get('/marketplace', auth, isModerator, async (req, res) => {
  try {
    const status = req.query.status || 'pending'; // pending | approved | rejected | blocked
    const result = { bots: [], miniApps: [] };

    if (status === 'pending') {
      result.bots = await User.find({ isBot: true, botModerationStatus: 'pending' })
        .select('username avatar banner bio owner botModerationStatus botModerationReason')
        .populate('owner', 'username avatar');
      result.miniApps = await MiniApp.find({ moderationStatus: 'pending', isSystem: { $ne: true } })
        .populate('owner', 'username avatar');
    } else if (status === 'approved') {
      result.bots = await User.find({ isBot: true, isPublished: true, botIsBlocked: { $ne: true } })
        .select('username avatar banner bio owner botModerationStatus')
        .populate('owner', 'username avatar');
      result.miniApps = await MiniApp.find({ isPublished: true, isBlocked: { $ne: true } })
        .populate('owner', 'username avatar');
    } else if (status === 'rejected') {
      result.bots = await User.find({ isBot: true, botModerationStatus: 'rejected' })
        .select('username avatar banner bio owner botModerationStatus botModerationReason')
        .populate('owner', 'username avatar');
      result.miniApps = await MiniApp.find({ moderationStatus: 'rejected' })
        .populate('owner', 'username avatar');
    } else if (status === 'blocked') {
      result.bots = await User.find({ isBot: true, botIsBlocked: true })
        .select('username avatar banner bio owner botBlockReason')
        .populate('owner', 'username avatar');
      result.miniApps = await MiniApp.find({ isBlocked: true })
        .populate('owner', 'username avatar');
    }
    res.json(result);
  } catch (e) {
    console.error('marketplace list error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Approve a pending submission: publish it to showcase.
router.post('/marketplace/:type/:id/approve', auth, isModerator, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'bot') {
      const bot = await User.findById(id);
      if (!bot || !bot.isBot) return res.status(404).json({ message: 'Бот не найден' });
      bot.botModerationStatus = 'approved';
      bot.isPublished = true;
      bot.botModerationReason = null;
      bot.botModeratedAt = new Date();
      bot.botModeratedBy = req.user._id;
      await bot.save();
    } else if (type === 'miniapp') {
      const app = await MiniApp.findById(id);
      if (!app) return res.status(404).json({ message: 'Приложение не найдено' });
      app.moderationStatus = 'approved';
      app.isPublished = true;
      app.moderationReason = null;
      app.moderatedAt = new Date();
      app.moderatedBy = req.user._id;
      await app.save();
    } else {
      return res.status(400).json({ message: 'Неверный тип' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Reject a pending submission with a reason.
router.post('/marketplace/:type/:id/reject', auth, isModerator, async (req, res) => {
  try {
    const { type, id } = req.params;
    const reason = (req.body?.reason || '').trim() || 'Не указана';
    if (type === 'bot') {
      const bot = await User.findById(id);
      if (!bot || !bot.isBot) return res.status(404).json({ message: 'Бот не найден' });
      bot.botModerationStatus = 'rejected';
      bot.isPublished = false;
      bot.botModerationReason = reason;
      bot.botModeratedAt = new Date();
      bot.botModeratedBy = req.user._id;
      await bot.save();
    } else if (type === 'miniapp') {
      const app = await MiniApp.findById(id);
      if (!app) return res.status(404).json({ message: 'Приложение не найдено' });
      app.moderationStatus = 'rejected';
      app.isPublished = false;
      app.moderationReason = reason;
      app.moderatedAt = new Date();
      app.moderatedBy = req.user._id;
      await app.save();
    } else {
      return res.status(400).json({ message: 'Неверный тип' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Force-block an already-published item (yanks it from showcase).
router.post('/marketplace/:type/:id/block', auth, isModerator, async (req, res) => {
  try {
    const { type, id } = req.params;
    const reason = (req.body?.reason || '').trim() || 'Без указания причины';
    if (type === 'bot') {
      const bot = await User.findById(id);
      if (!bot || !bot.isBot) return res.status(404).json({ message: 'Бот не найден' });
      bot.botIsBlocked = true;
      bot.botBlockReason = reason;
      bot.isPublished = false;
      bot.botModerationStatus = 'rejected';
      bot.botModeratedAt = new Date();
      bot.botModeratedBy = req.user._id;
      await bot.save();
    } else if (type === 'miniapp') {
      const app = await MiniApp.findById(id);
      if (!app) return res.status(404).json({ message: 'Приложение не найдено' });
      app.isBlocked = true;
      app.blockReason = reason;
      app.isPublished = false;
      app.moderationStatus = 'rejected';
      app.moderatedAt = new Date();
      app.moderatedBy = req.user._id;
      await app.save();
    } else {
      return res.status(400).json({ message: 'Неверный тип' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Unblock a previously-blocked item (returns to draft — author must resubmit).
router.post('/marketplace/:type/:id/unblock', auth, isModerator, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'bot') {
      const bot = await User.findById(id);
      if (!bot || !bot.isBot) return res.status(404).json({ message: 'Бот не найден' });
      bot.botIsBlocked = false;
      bot.botBlockReason = null;
      bot.botModerationStatus = 'draft';
      await bot.save();
    } else if (type === 'miniapp') {
      const app = await MiniApp.findById(id);
      if (!app) return res.status(404).json({ message: 'Приложение не найдено' });
      app.isBlocked = false;
      app.blockReason = null;
      app.moderationStatus = 'draft';
      await app.save();
    } else {
      return res.status(400).json({ message: 'Неверный тип' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
