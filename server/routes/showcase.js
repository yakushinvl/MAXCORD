const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MiniApp = require('../models/MiniApp');
const auth = require('../middleware/auth');

// Get all published bots and mini-apps
router.get('/', auth, async (req, res) => {
    try {
        // Strict moderation: only approved + not-blocked. System mini-apps bypass.
        const bots = await User.find({
                isBot: true,
                isPublished: true,
                botIsBlocked: { $ne: true },
                botModerationStatus: 'approved',
            })
            .select('username bio avatar banner createdAt');

        const miniApps = await MiniApp.find({
                isPublished: true,
                isBlocked: { $ne: true },
                $or: [
                    { moderationStatus: 'approved' },
                    { isSystem: true },
                ],
            })
            .select('name url description avatar banner createdAt isSystem');

        res.json({ bots, miniApps });
    } catch (error) {
        console.error('Showcase fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
