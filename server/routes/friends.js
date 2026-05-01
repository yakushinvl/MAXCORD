const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Friendship = require('../models/Friendship');
const User = require('../models/User');

router.get('/', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({ $or: [{ requester: req.user._id, status: 'accepted' }, { recipient: req.user._id, status: 'accepted' }] }).populate('requester', 'username avatar status badges activity').populate('recipient', 'username avatar status badges activity');
    const friends = friendships.map(f => {
      const friend = f.requester._id.toString() === req.user._id.toString() ? f.recipient : f.requester;
      return { ...friend.toObject(), friendshipId: f._id };
    });
    res.json(friends);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/pending', auth, async (req, res) => {
  try {
    const requests = await Friendship.find({ recipient: req.user._id, status: 'pending' }).populate('requester', 'username avatar status badges activity');
    res.json(requests);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/request', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot add yourself as friend' });
    const recipient = await User.findById(userId);
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    const existing = await Friendship.findOne({ $or: [{ requester: req.user._id, recipient: userId }, { requester: userId, recipient: req.user._id }] });
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ message: 'Already friends' });
      if (existing.status === 'pending' && existing.recipient.toString() === userId) return res.status(400).json({ message: 'Friend request already sent' });
      if (existing.status === 'pending' && existing.requester.toString() === userId) {
        existing.status = 'accepted';
        await existing.save();
        return res.json({ message: 'Friend request accepted', friendship: existing });
      }
    }
    const friendship = new Friendship({ requester: req.user._id, recipient: userId, status: 'pending' });
    await friendship.save();
    await friendship.populate('requester', 'username avatar status badges activity');
    await friendship.populate('recipient', 'username avatar status badges activity');

    // Notify recipient
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${userId}`).emit('friend-request', friendship);
    }

    res.status(201).json(friendship);
  } catch (error) { if (error.code === 11000) return res.status(400).json({ message: 'Friend request already exists' }); res.status(500).json({ message: 'Server error' }); }
});

router.post('/accept/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ message: 'Friend request not found' });
    if (friendship.recipient.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    if (friendship.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
    friendship.status = 'accepted';
    await friendship.save();
    await friendship.populate('requester', 'username avatar status badges activity');
    await friendship.populate('recipient', 'username avatar status badges activity');

    // Notify requester
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${friendship.requester._id}`).emit('friend-request-accepted', friendship);
    }

    res.json(friendship);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship) return res.status(404).json({ message: 'Friendship not found' });
    const isRequester = friendship.requester.toString() === req.user._id.toString();
    const isRecipient = friendship.recipient.toString() === req.user._id.toString();
    if (!isRequester && !isRecipient) return res.status(403).json({ message: 'Not authorized' });
    await Friendship.findByIdAndDelete(req.params.id);
    res.json({ message: 'Friendship removed' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);
    const users = await User.find({ $or: [{ username: { $regex: query, $options: 'i' } }, { email: { $regex: query, $options: 'i' } }], _id: { $ne: req.user._id } }).select('username avatar status email badges activity').limit(20);
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
