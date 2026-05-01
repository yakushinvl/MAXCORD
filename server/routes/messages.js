const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const { computePermissions, hasPermission } = require('../utils/permissionCalculator');
const { Permissions } = require('../utils/permissions');
const { logAction } = require('../utils/auditLogger');

router.get('/channel/:channelId', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    let query = { channel: req.params.channelId };
    if (before) query.createdAt = { $lt: new Date(before) };
    const messages = await Message.find(query).populate('author', 'username avatar badges').populate({ path: 'replyTo', populate: { path: 'author', select: 'username avatar badges' } }).populate('mentions', 'username avatar badges').sort({ createdAt: -1 }).limit(parseInt(limit)).exec();
    res.json(messages.reverse());
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { content, channelId, replyTo, attachments } = req.body;
    const message = new Message({ content, author: req.user._id, channel: channelId, replyTo, attachments: attachments || [] });
    await message.save();
    await message.populate('author', 'username avatar badges');
    if (replyTo) await message.populate('replyTo');
    res.status(201).json(message);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.author.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can only edit your own messages' });
    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();
    await message.populate('author', 'username avatar badges');
    res.json(message);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    let isModeratorDelete = false;
    if (message.author.toString() !== req.user._id.toString()) {
      // Check if moderator
      if (message.channel) {
        const channel = await Channel.findById(message.channel);
        const server = await Server.findById(channel?.server);
        if (server) {
          const perms = computePermissions(req.user._id, server, channel);
          if (hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
            isModeratorDelete = true;
          } else {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const channelId = message.channel;
    const authorId = message.author;
    const contentPreview = message.content?.substring(0, 50);

    await Message.findByIdAndDelete(req.params.id);

    if (isModeratorDelete && channelId) {
      const channel = await Channel.findById(channelId);
      if (channel) {
        await logAction({
          serverId: channel.server,
          executorId: req.user._id,
          targetId: authorId,
          targetModel: 'User',
          action: 'MESSAGE_DELETE',
          reason: `Deleted message: "${contentPreview}..." in #${channel.name}`
        });
      }
    }

    res.json({ message: 'Message deleted' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/channel/:channelId/pins', auth, async (req, res) => {
  try {
    const pins = await Message.find({ channel: req.params.channelId, pinned: true })
      .populate('author', 'username avatar badges')
      .populate('mentions', 'username avatar badges')
      .sort({ pinnedAt: -1 });
    res.json(pins);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.patch('/:id/pin', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.channel) {
      const channel = await Channel.findById(message.channel);
      const server = await Server.findById(channel?.server);
      if (server) {
        const perms = computePermissions(req.user._id, server, channel);
        if (!hasPermission(perms, Permissions.PIN_MESSAGES)) {
          return res.status(403).json({ message: 'У вас нет прав для закрепления сообщений' });
        }
      }
    }

    message.pinned = !message.pinned;
    if (message.pinned) {
      message.pinnedAt = new Date();
    } else {
      message.pinnedAt = undefined;
    }

    await message.save();

    if (message.channel) {
      const channel = await Channel.findById(message.channel);
      if (channel) {
        await logAction({
          serverId: channel.server,
          executorId: req.user._id,
          targetId: message.author,
          targetModel: 'User',
          action: message.pinned ? 'MESSAGE_PIN' : 'MESSAGE_UNPIN',
          reason: `In #${channel.name}: "${message.content?.substring(0, 50)}..."`
        });
      }
    }

    await message.populate('author', 'username avatar badges');

    const io = req.app.get('io');
    if (io) {
      const room = message.channel ? `channel-${message.channel}` : `dm-${message.directMessage}`;
      // Note: dm- room name might be different, but in server.js it seems to use user specific rooms or channels
      // but Message objects have channel or directMessage IDs.
      if (message.channel) {
        io.to(`channel-${message.channel}`).emit('message-pinned-update', message);
      } else {
        // For DMs, we notify participants
        const DirectMessage = require('../models/DirectMessage');
        const dm = await DirectMessage.findById(message.directMessage);
        if (dm) {
          dm.participants.forEach(p => {
            io.to(`user-${p}`).emit('message-pinned-update', message);
          });
        }
      }
    }

    res.json(message);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/reactions', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    let reaction = message.reactions.find(r => r.emoji === emoji);
    if (reaction) {
      const userIndex = reaction.users.indexOf(req.user._id);
      if (userIndex > -1) {
        // Toggle off
        reaction.users.splice(userIndex, 1);
        if (reaction.users.length === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        // Add user
        reaction.users.push(req.user._id);
      }
    } else {
      // New reaction
      message.reactions.push({ emoji, users: [req.user._id] });
    }

    await message.save();

    // Notify via Socket.io
    const io = req.app.get('io');
    if (io) {
      const payload = { messageId: message._id, reactions: message.reactions };
      if (message.channel) {
        io.to(`channel-${message.channel}`).emit('message-reactions-update', payload);
      } else if (message.directMessage) {
        const DirectMessage = require('../models/DirectMessage');
        const dm = await DirectMessage.findById(message.directMessage);
        if (dm) {
          dm.participants.forEach(p => io.to(`user-${p}`).emit('message-reactions-update', payload));
        }
      }
    }

    res.json(message.reactions);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/channel/:channelId/attachments', auth, async (req, res) => {
  try {
    const messages = await Message.find({ 
      channel: req.params.channelId, 
      attachments: { $exists: true, $not: { $size: 0 } } 
    })
    .populate('author', 'username avatar badges')
    .sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/dm/:dmId/attachments', auth, async (req, res) => {
  try {
    const messages = await Message.find({ 
      directMessage: req.params.dmId, 
      attachments: { $exists: true, $not: { $size: 0 } } 
    })
    .populate('author', 'username avatar badges')
    .sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
