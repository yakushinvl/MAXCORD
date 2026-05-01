const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/Message');

router.get('/', auth, async (req, res) => {
  try {
    const dms = await DirectMessage.find({ participants: req.user._id }).populate('participants', 'username avatar status badges activity').sort({ updatedAt: -1 });
    res.json(dms);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const dm = await DirectMessage.findById(req.params.id).populate('participants', 'username avatar status badges activity');
    if (!dm) return res.status(404).json({ message: 'DM not found' });
    if (!dm.participants.some(p => p._id.toString() === req.user._id.toString())) return res.status(403).json({ message: 'Access denied' });
    res.json(dm);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid user ID' });
    if (userId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot create DM with yourself' });
    let dm = await DirectMessage.findOne({ participants: { $size: 2, $all: [req.user._id, userId] } }).populate('participants', 'username avatar status badges activity');
    if (!dm) {
      dm = new DirectMessage({ participants: [req.user._id, userId] });
      await dm.save();
      await dm.populate('participants', 'username avatar status badges activity');
    }
    res.json(dm);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/group', auth, async (req, res) => {
  try {
    const { userIds, name } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length < 1) {
      return res.status(400).json({ message: 'At least one other user is required' });
    }

    // Include the creator in the participants
    const participants = [...new Set([...userIds, req.user._id.toString()])];

    // If it's just 2 people total, check if a DM already exists
    if (participants.length === 2) {
      let dm = await DirectMessage.findOne({ participants: { $size: 2, $all: participants } }).populate('participants', 'username avatar status badges activity');
      if (dm) return res.json(dm);
    }

    const dm = new DirectMessage({
      participants,
      name: name || null
    });

    await dm.save();
    await dm.populate('participants', 'username avatar status activity');
    res.status(201).json(dm);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const dm = await DirectMessage.findById(req.params.id);
    if (!dm) return res.status(404).json({ message: 'DM not found' });
    if (!dm.participants.some(p => p.toString() === req.user._id.toString())) return res.status(403).json({ message: 'Access denied' });

    let query = { channel: null, directMessage: dm._id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .populate('author', 'username avatar badges activity')
      .populate('mentions', 'username avatar badges activity')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .exec();
    res.json(messages.reverse());
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content, attachments, type } = req.body;
    const dm = await DirectMessage.findById(req.params.id);
    if (!dm) return res.status(404).json({ message: 'DM not found' });
    if (!dm.participants.some(p => p.toString() === req.user._id.toString())) return res.status(403).json({ message: 'Access denied' });
    const message = new Message({ content, author: req.user._id, channel: null, directMessage: dm._id, attachments: attachments || [], type: type || 'default' });
    await message.save();
    await message.populate('author', 'username avatar badges activity');
    dm.updatedAt = new Date();
    await dm.save();
    const io = req.app.get('io');
    if (io) dm.participants.forEach(participantId => { io.to(`user-${participantId}`).emit('new-message', message); });
    res.status(201).json(message);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id/pins', auth, async (req, res) => {
  try {
    const dmId = req.params.id;
    const pins = await Message.find({ directMessage: dmId, pinned: true })
      .populate('author', 'username avatar badges activity')
      .populate('mentions', 'username avatar badges activity')
      .sort({ pinnedAt: -1 });
    res.json(pins);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
