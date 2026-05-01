const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const Channel = require('../models/Channel');

router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const group = new Group({ name, description, icon, owner: req.user._id, members: [{ user: req.user._id }] });
    await group.save();
    const generalChannel = new Channel({ name: 'general', type: 'text', server: null, group: group._id, position: 0 });
    await generalChannel.save();
    group.channels.push(generalChannel._id);
    await group.save();
    const populatedGroup = await Group.findById(group._id).populate('owner', 'username avatar').populate('members.user', 'username avatar status activity').populate('channels');
    res.status(201).json(populatedGroup);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/me', auth, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id }).populate('owner', 'username avatar').populate('channels').populate('members.user', 'username avatar status activity');
    res.json(groups);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('owner', 'username avatar').populate('channels').populate('members.user', 'username avatar status activity');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });
    res.json(group);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can add members' });
    if (group.members.some(m => m.user.toString() === userId)) return res.status(400).json({ message: 'User is already a member' });
    group.members.push({ user: userId });
    await group.save();
    const populatedGroup = await Group.findById(group._id).populate('owner', 'username avatar').populate('channels').populate('members.user', 'username avatar status activity');
    res.json(populatedGroup);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.owner.toString() !== req.user._id.toString() && req.params.userId !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    group.members = group.members.filter(m => m.user.toString() !== req.params.userId);
    await group.save();
    res.json({ message: 'Member removed' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can update group' });
    const { name, description, icon } = req.body;
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (icon !== undefined) group.icon = icon;
    await group.save();
    const populatedGroup = await Group.findById(group._id).populate('owner', 'username avatar').populate('channels').populate('members.user', 'username avatar status activity');
    res.json(populatedGroup);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can delete group' });
    await Channel.deleteMany({ group: group._id });
    await Group.findByIdAndDelete(req.params.id);
    res.json({ message: 'Group deleted' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
