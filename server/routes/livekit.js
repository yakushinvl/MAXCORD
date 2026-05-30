const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');
const auth = require('../middleware/auth');

// @route   GET api/livekit/token
// @desc    Get LiveKit access token
// @access  Private
router.get('/token', auth, async (req, res) => {
    try {
        const { roomName, identity } = req.query;

        if (!roomName || !identity) {
            return res.status(400).json({ message: 'Room name and identity are required' });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const host = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !host) {
            return res.status(500).json({ message: 'LiveKit configuration is missing on server' });
        }

        const identityStr = String(identity);
        const roomNameStr = String(roomName);

        const at = new AccessToken(apiKey, apiSecret, {
            identity: identityStr,
            name: identityStr,
        });

        at.addGrant({
            roomJoin: true,
            room: roomNameStr,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        const token = await at.toJwt();
        console.log(`[LiveKit] Generated token for ${identityStr} in ${roomNameStr}. Token length: ${token.length}`);

        res.json({ token, serverUrl: host });
    } catch (err) {
        console.error('LiveKit token error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   POST api/livekit/webhook
// @desc    Handle LiveKit webhooks
// @access  Public (Uses LiveKit signature verification)
router.post('/webhook', async (req, res) => {
    try {
        const { WebhookReceiver } = require('livekit-server-sdk');
        const receiver = new WebhookReceiver(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET
        );

        // Verify and decode the webhook
        // LiveKit sends the body as raw bytes or string, express.json() might have parsed it already
        // receiver.receive handles both
        const event = await receiver.receive(req.body, req.get('Authorization'));

        console.log(`[LiveKit Webhook] Event: ${event.event}, Room: ${event.room?.name}, Participant: ${event.participant?.identity}`);

        if (event.event === 'participant_left') {
            const userId = event.participant.identity;
            const roomName = event.room.name; // e.g., "channel-ID"

            if (roomName.startsWith('channel-')) {
                const channelId = roomName.replace('channel-', '');
                const io = req.app.get('io');
                const voiceManager = req.app.get('voiceManager');

                if (io) {
                    // Force-evict every socket belonging to this user from the voice-channel room.
                    // We walk the voice-channel room itself (not the user room) so phantoms whose
                    // user-{id} room has already been cleaned still get removed.
                    const voiceRoom = io.sockets.adapter.rooms.get(`voice-channel-${channelId}`);
                    if (voiceRoom) {
                        for (const socketId of Array.from(voiceRoom)) {
                            const socket = io.sockets.sockets.get(socketId);
                            if (socket && String(socket.userId) === String(userId)) {
                                console.log(`[LiveKit Webhook] Evicting socket ${socketId} for user ${userId}`);
                                socket.leave(`voice-channel-${channelId}`);
                                socket.voiceChannelId = null;
                            } else if (!socket) {
                                voiceRoom.delete(socketId);
                            }
                        }
                    }

                    io.to(`voice-channel-${channelId}`).emit('voice-user-left', { userId });
                    if (voiceManager) {
                        await voiceManager.notifyVoiceChannelUpdate(channelId);
                    }
                }
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('LiveKit Webhook error:', err);
        res.status(400).json({ message: 'Invalid webhook' });
    }
});

module.exports = router;
