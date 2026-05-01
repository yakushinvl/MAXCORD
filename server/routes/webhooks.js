const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const Server = require('../models/Server');

// Post a message via webhook
router.post('/:botToken/:channelId', async (req, res) => {
    try {
        const { botToken, channelId } = req.params;

        // 1. Verify Bot
        const bot = await User.findOne({ botToken, isBot: true });
        if (!bot) return res.status(401).json({ message: 'Invalid bot token' });

        // 2. Verify Channel is valid and Bot is in the server
        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        const server = await Server.findById(channel.server);
        if (!server || !server.members.some(m => m.user.toString() === bot._id.toString())) {
            return res.status(403).json({ message: 'Bot is not a member of this server' });
        }

        // 3. Process Content (Generic or Github)
        let content = req.body.content || '';
        let buttons = req.body.buttons || [];

        // GitHub Push Event Parsing
        if (req.headers['x-github-event'] === 'push' && req.body.commits) {
            const repo = req.body.repository?.full_name || 'unknown_repo';
            const pusher = req.body.pusher?.name || 'unknown_user';
            const commitCount = req.body.commits.length;
            content = `**[GitHub]** \`${pusher}\` pushed \`${commitCount}\` commit(s) to \`${repo}\`:\n` +
                req.body.commits.map(c => `- ${c.message} ([View](${c.url}))`).join('\n');
        }

        if (!content && (!req.body.attachments || req.body.attachments.length === 0)) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        // Create Message
        const messageData = {
            content,
            author: bot._id,
            channel: channelId,
            buttons: buttons.map(b => ({ label: b.label || 'Link', url: b.url, actionId: b.actionId, style: b.style || 'primary' }))
        };

        const message = new Message(messageData);
        await message.save();
        await message.populate('author', 'username avatar');

        // Emit via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`channel-` + channelId).emit('new-message', message);
        }

        res.status(200).json({ success: true, messageId: message._id });

    } catch (e) {
        console.error('Webhook error:', e);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
