const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Invite = require('../models/Invite');
const Server = require('../models/Server');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

const generateCode = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

router.post('/', auth, async (req, res) => {
    try {
        const { serverId, expiresIn, maxUses } = req.body;
        const server = await Server.findById(serverId);
        if (!server) return res.status(404).json({ message: 'Server not found' });
        let code = generateCode();
        while (await Invite.findOne({ code })) code = generateCode();
        let expiresAt = null;
        if (expiresIn) expiresAt = new Date(Date.now() + expiresIn * 1000);
        const invite = new Invite({ code, server: serverId, creator: req.user._id, expiresAt, maxUses: maxUses || null });
        await invite.save();

        await logAction({
          serverId: serverId,
          executorId: req.user._id,
          targetId: invite._id,
          targetModel: 'Server', // Or Invite if we had it, but Server is fine
          action: 'INVITE_CREATE',
          changes: [{ key: 'code', newValue: code }, { key: 'maxUses', newValue: maxUses }]
        });

        res.status(201).json(invite);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Public route to view invite details
router.get('/:code', async (req, res) => {
    try {
        const invite = await Invite.findOne({ code: req.params.code }).populate('server', 'name icon description members').populate('creator', 'username');
        if (!invite) return res.status(404).json({ message: 'Invite not found' });
        if (invite.expiresAt && invite.expiresAt < Date.now()) return res.status(410).json({ message: 'Invite expired' });
        if (invite.maxUses && invite.uses >= invite.maxUses) return res.status(410).json({ message: 'Invite limit reached' });
        res.json({
            code: invite.code,
            server: { _id: invite.server._id, name: invite.server.name, icon: invite.server.icon, description: invite.server.description, memberCount: invite.server.members.length },
            inviter: invite.creator
        });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:code/join', auth, async (req, res) => {
    try {
        const invite = await Invite.findOne({ code: req.params.code });
        if (!invite) return res.status(404).json({ message: 'Invite not found' });
        if (invite.expiresAt && invite.expiresAt < Date.now()) return res.status(410).json({ message: 'Invite expired' });
        if (invite.maxUses && invite.uses >= invite.maxUses) return res.status(410).json({ message: 'Invite limit reached' });
        const server = await Server.findById(invite.server);
        if (!server) return res.status(404).json({ message: 'Server no longer exists' });
        const isMember = server.members.some(member => member.user.toString() === req.user._id.toString());
        if (isMember) return res.status(400).json({ message: 'Already a member' });
        server.members.push({ user: req.user._id });
        await server.save();
        const user = await User.findById(req.user._id);
        if (!user.servers) user.servers = [];
        if (!user.servers.includes(server._id)) { user.servers.push(server._id); await user.save(); }
        invite.uses += 1;
        await invite.save();
        const populatedServer = await Server.findById(server._id).populate('owner', 'username avatar').populate('channels').populate('members.user', 'username avatar status');
        const io = req.app.get('io');
        if (io) {
            const newMember = populatedServer.members.find(m => m.user._id.toString() === req.user._id.toString());
            io.to(`server-${server._id}`).emit('server-member-joined', { serverId: server._id, member: newMember, server: populatedServer });
            io.to(`server-${server._id}`).emit('server-updated', populatedServer);
        }
        res.json(populatedServer);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
