const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const { Permissions } = require('../utils/permissions');
const Channel = require('../models/Channel');
const Server = require('../models/Server');
const { logAction } = require('../utils/auditLogger');

router.post('/', auth, checkPermission(Permissions.MANAGE_CHANNELS, 'body.serverId'), async (req, res) => {
  try {
    const { name, type, serverId, category, position, topic } = req.body;
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const channel = new Channel({ name, type: type || 'text', server: serverId, category, position: position || server.channels.length, topic });
    await channel.save();
    server.channels.push(channel._id);
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: channel._id,
      targetModel: 'Channel',
      action: 'CHANNEL_CREATE',
      changes: [{ key: 'name', newValue: name }, { key: 'type', newValue: type }]
    });
    const io = req.app.get('io');
    if (io) {
      const updatedServer = await Server.findById(serverId).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${serverId}`).emit('server-updated', updatedServer);
    }
    res.status(201).json(channel);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/server/:serverId', auth, async (req, res) => {
  try {
    const channels = await Channel.find({ server: req.params.serverId }).sort({ position: 1 }).populate('category');
    res.json(channels);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id).populate('server').populate('category');
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json(channel);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id', auth, async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    req.serverId = channel.server;
    next();
  } catch (err) { next(err); }
}, checkPermission(Permissions.MANAGE_CHANNELS), async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    const { name, topic, position, permissionOverwrites } = req.body;
    if (name) channel.name = name;
    if (topic !== undefined) channel.topic = topic;
    if (position !== undefined) channel.position = position;
    if (permissionOverwrites !== undefined) channel.permissionOverwrites = permissionOverwrites;
    await channel.save();

    await logAction({
      serverId: channel.server,
      executorId: req.user._id,
      targetId: channel._id,
      targetModel: 'Channel',
      action: 'CHANNEL_UPDATE',
      changes: Object.keys(req.body).map(k => ({ key: k, newValue: req.body[k] }))
    });

    const io = req.app.get('io');
    if (io) {
      const updatedServer = await Server.findById(channel.server).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${channel.server}`).emit('server-updated', updatedServer);
    }
    res.json(channel);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    req.serverId = channel.server;
    next();
  } catch (err) { next(err); }
}, checkPermission(Permissions.MANAGE_CHANNELS), async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    const serverId = channel.server;
    await Channel.findByIdAndDelete(req.params.id);
    const server = await Server.findById(serverId);
    if (server) {
      server.channels = server.channels.filter(id => id.toString() !== req.params.id);
      await server.save();

      await logAction({
        serverId: serverId,
        executorId: req.user._id,
        targetId: serverId, // Server is target since channel is gone
        targetModel: 'Server',
        action: 'CHANNEL_DELETE',
        reason: `Deleted channel #${channel.name}`
      });
    }
    const io = req.app.get('io');
    if (io) {
      const updatedServer = await Server.findById(serverId).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${serverId}`).emit('server-updated', updatedServer);
    }
    res.json({ message: 'Channel deleted' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
