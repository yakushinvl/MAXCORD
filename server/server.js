const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Server = require('./models/Server');
const Channel = require('./models/Channel');
const Message = require('./models/Message');
const User = require('./models/User');
const { computePermissions, hasPermission } = require('./utils/permissionCalculator');
const { Permissions } = require('./utils/permissions');
const { logAction } = require('./utils/auditLogger');

const compression = require('compression');

const app = express();
const server = http.createServer(app);

app.use(compression());

const io = socketIo(server, {
  cors: { origin: [process.env.CLIENT_URL || "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3000"], methods: ["GET", "POST"] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:3000', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://maxcord.duckdns.com', 'http://maxcord.duckdns.com', 'https://maxcord.fun', 'http://maxcord.fun'];
    if (allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) callback(null, true);
    else callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/direct-messages', require('./routes/directMessages'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/invites', require('./routes/invites'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/miniapps', require('./routes/miniapps'));
app.use('/api/showcase', require('./routes/showcase'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/upload-files', require('./routes/uploads'));
app.use('/api/livekit', require('./routes/livekit'));
app.get(['/maxcord-sdk.js', '/maxcord-sdk.js'], (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'public/maxcord-sdk.js'));
});
app.use('/miniapps', express.static(path.join(__dirname, 'public/miniapps'), {
  setHeaders: (res) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https: http: file: maxcord:;");
  }
}));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/version', require('./routes/version'));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  immutable: true,
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// Serve static assets from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/^(?!\/api).+/, (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https: http: file: maxcord:;");
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const getVoiceChannelUsers = async (channelId) => {
  const room = io.sockets.adapter.rooms.get(`voice-channel-${channelId}`);
  if (!room) return [];
  const users = [];
  const User = require('./models/User');
  // Build nickname map for this server's members
  let nickByUserId = new Map();
  try {
    const channel = await Channel.findById(channelId).select('server');
    if (channel?.server) {
      const srv = await Server.findById(channel.server).select('members');
      (srv?.members || []).forEach(m => {
        if (m.user && m.nickname) nickByUserId.set(String(m.user), m.nickname);
      });
    }
  } catch (e) { /* fall back to username */ }
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId) {
      const user = await User.findById(socket.userId).select('username avatar status banner badges activity');
      if (user) {
        const userData = user.toObject();
        userData.isMuted = socket.isMuted || false;
        userData.isDeafened = socket.isDeafened || false;
        userData.isScreenSharing = socket.isScreenSharing || false;
        userData.isServerMuted = socket.isServerMuted || false;
        userData.isServerDeafened = socket.isServerDeafened || false;
        userData.nickname = nickByUserId.get(String(user._id)) || null;
        users.push(userData);
      }
    }
  }
  return users;
};

const notifyVoiceChannelUpdate = async (channelId) => {
  try {
    const channel = await Channel.findById(channelId);
    if (channel) {
      const users = await getVoiceChannelUsers(channelId);
      io.to(`server-${channel.server}`).emit('voice-channel-users-update', { channelId, users });
    }
  } catch (err) { }
};

app.get('/api/channels/:id/voice-participants', async (req, res) => {
  try { res.json(await getVoiceChannelUsers(req.params.id)); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
});

const voiceChannelYouTubeStates = new Map();

// --- Voice presences (mini-app virtual participants) ---
// Map<channelId, Map<sessionId, presence>>
const voicePresencesByChannel = new Map();

function getPresencesSnapshot(channelId) {
  const m = voicePresencesByChannel.get(String(channelId));
  return m ? Array.from(m.values()) : [];
}
function setPresence(channelId, presence) {
  const key = String(channelId);
  let m = voicePresencesByChannel.get(key);
  if (!m) { m = new Map(); voicePresencesByChannel.set(key, m); }
  m.set(presence.sessionId, presence);
}
function removePresence(channelId, sessionId) {
  const m = voicePresencesByChannel.get(String(channelId));
  if (!m) return null;
  const p = m.get(sessionId);
  if (!p) return null;
  m.delete(sessionId);
  if (m.size === 0) voicePresencesByChannel.delete(String(channelId));
  return p;
}
function cleanupUserPresencesInChannel(channelId, userId, io) {
  const m = voicePresencesByChannel.get(String(channelId));
  if (!m) return;
  for (const [sid, p] of Array.from(m.entries())) {
    if (String(p.ownerUserId) === String(userId)) {
      m.delete(sid);
      io.to(`voice-channel-${channelId}`).emit('voice-presence-removed', { sessionId: sid, channelId });
    }
  }
  if (m.size === 0) voicePresencesByChannel.delete(String(channelId));
}
function cleanupUserPresencesEverywhere(userId, io) {
  for (const [chId, m] of voicePresencesByChannel.entries()) {
    for (const [sid, p] of Array.from(m.entries())) {
      if (String(p.ownerUserId) === String(userId)) {
        m.delete(sid);
        io.to(`voice-channel-${chId}`).emit('voice-presence-removed', { sessionId: sid, channelId: chId });
      }
    }
    if (m.size === 0) voicePresencesByChannel.delete(chId);
  }
}

app.set('io', io);
app.set('voiceManager', { getVoiceChannelUsers, notifyVoiceChannelUpdate });

// Periodic sweep: kick zombie sockets (disconnected but still listed in voice rooms)
// out of voice-channel rooms and notify everyone. This is a safety net for cases
// where the normal disconnect event never fires (proxy keepalives, transport upgrades,
// abrupt power loss without TCP RST, etc.).
setInterval(async () => {
  try {
    const affectedChannels = new Set();
    for (const [roomName, sockets] of io.sockets.adapter.rooms.entries()) {
      if (!roomName.startsWith('voice-channel-')) continue;
      const channelId = roomName.replace('voice-channel-', '');
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (!s || !s.connected) {
          if (s) {
            s.leave(roomName);
            s.voiceChannelId = null;
          } else {
            sockets.delete(sid);
          }
          if (s && s.userId) {
            io.to(roomName).emit('voice-user-left', { userId: s.userId });
          }
          affectedChannels.add(channelId);
        }
      }
    }
    for (const channelId of affectedChannels) {
      await notifyVoiceChannelUpdate(channelId);
    }
  } catch (err) {
    console.error('Voice sweep error:', err);
  }
}, 10000);
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      if (token.startsWith('bot_')) {
        const User = require('./models/User');
        const bot = await User.findOne({ botToken: token, isBot: true });
        if (bot) {
          socket.userId = bot._id;
          socket.isBot = true;
          return next();
        }
      }

      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'maxcord_fallback_secret_key_2026';
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId;
      next();
      } catch (err) { next(new Error('Authentication error')); }
  } else next(new Error('Authentication error'));
});

io.on('connection', (socket) => {
  socket.join(`user-${String(socket.userId)}`);
  socket.emit('ready', { userId: socket.userId });
  const updateStatusOnConnect = async () => {
    try {
      const user = await User.findById(socket.userId);
      if (user) {
        if (user.servers) user.servers.forEach(s => socket.join(`server-${s}`));
        if (user.status === 'offline') {
          const newStatus = user.statusPreference || 'online';
          user.status = newStatus;
          await user.save();
          io.emit('user-updated', { _id: user._id, status: newStatus });
        }
      }
    } catch (err) { }
  };
  updateStatusOnConnect();

  socket.on('join-server', async (serverId) => {
    socket.join(`server-${serverId}`);
    try {
      const server = await Server.findById(serverId).populate('channels');
      if (server) {
        const voiceStates = {};
        for (const ch of server.channels) if (ch.type === 'voice') voiceStates[ch._id] = await getVoiceChannelUsers(ch._id);
        socket.emit('server-voice-states', voiceStates);
        io.to(`server-${serverId}`).emit('server-voice-states', voiceStates);
      }
    } catch (err) { }
  });

  socket.on('leave-server', (serverId) => socket.leave(`server-${serverId}`));
  socket.on('join-channel', (channelId) => socket.join(`channel-${channelId}`));
  socket.on('leave-channel', (channelId) => socket.leave(`channel-${channelId}`));

  socket.on('send-message', async (data, callback) => {
    try {
      const user = await User.findById(socket.userId);
      if (user && user.isBanned) {
        if (user.banExpires && user.banExpires < Date.now()) {
          user.isBanned = false;
          user.banExpires = undefined;
          user.banReason = undefined;
          await user.save();
        } else {
          return socket.emit('error', { message: 'Ваш аккаунт заблокирован. Вы не можете отправлять сообщения.' });
        }
      }

      const messageData = {
        content: data.content || '',
        author: socket.userId,
        channel: data.channelId || null,
        directMessage: data.dmId || null,
        attachments: [],
        embeds: Array.isArray(data.embeds) ? data.embeds : [],
        buttons: Array.isArray(data.buttons) ? data.buttons.map(b => ({
          label: b.label,
          url: b.url,
          actionId: b.actionId,
          style: b.style || 'primary',
          row: b.row || 0
        })) : [],
        replyTo: data.replyToId || null
      };

      if (data.attachments) {
        let raw = data.attachments;
        if (typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))) { try { raw = JSON.parse(raw); } catch (e) { } }
        if (!Array.isArray(raw)) raw = [raw];
        messageData.attachments = raw.filter(a => a && typeof a === 'object' && a.url).map(a => ({ url: String(a.url), filename: String(a.filename || ''), size: Number(a.size || 0), type: String(a.type || '') }));
      }
      if (data.channelId) {
        const channel = await Channel.findById(data.channelId);
        if (!channel) return socket.emit('error', { message: 'Channel not found' });
        const server = await Server.findById(channel.server);
        if (!server) return socket.emit('error', { message: 'Server not found' });
        const perms = computePermissions(socket.userId, server, channel);
        if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
          return socket.emit('error', { message: 'У вас нет прав для отправки сообщений в этот канал' });
        }
      }
      const message = new Message(messageData);

      // Parse mentions
      if (message.content) {
        const foundMentions = [];

        // Handle User Mentions
        const userMentionRegex = /@(\w+)/g;
        let userMatch;
        while ((userMatch = userMentionRegex.exec(message.content)) !== null) {
          const username = userMatch[1];
          const mentionedUser = await User.findOne({ username });
          if (mentionedUser) {
            if (data.channelId) {
              const channel = await Channel.findById(data.channelId);
              const server = await Server.findById(channel?.server);
              if (server && server.members.some(m => String(m.user) === String(mentionedUser._id))) {
                foundMentions.push(mentionedUser._id);
              }
            } else {
              foundMentions.push(mentionedUser._id);
            }
          }
        }

        // Handle Role Mentions (only in channels)
        if (data.channelId) {
          const channel = await Channel.findById(data.channelId);
          const server = await Server.findById(channel?.server);
          if (server) {
            const perms = computePermissions(socket.userId, server, channel);
            const canMentionEveryone = hasPermission(perms, Permissions.MENTION_EVERYONE);

            server.roles.forEach(role => {
              if (message.content.includes(`@${role.name}`)) {
                // If it's a role mention, verify permission or if role is mentionable
                if (canMentionEveryone || role.mentionable) {
                  server.members.forEach(member => {
                    if (member.roles.some(r => String(r) === String(role._id))) {
                      foundMentions.push(member.user);
                    }
                  });
                }
              }
            });

            // Handle @everyone and @here
            if (message.content.includes('@everyone') || message.content.includes('@here')) {
              if (canMentionEveryone) {
                server.members.forEach(member => {
                  foundMentions.push(member.user);
                });
              }
            }
          }
        }

        if (foundMentions.length > 0) {
          message.mentions = [...new Set(foundMentions.map(id => String(id)))];
        }
      }

      // Extract URL Previews
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.content ? message.content.match(urlRegex) : null;
      if (urls && urls.length > 0) {
        try {
          const { getUrlPreview } = require('./utils/urlPreview');
          const uniqueUrls = [...new Set(urls)];
          const previewPromises = uniqueUrls.slice(0, 3).map(getUrlPreview);
          const previews = await Promise.all(previewPromises);
          const validPreviews = previews.filter(p => p !== null);
          if (validPreviews.length > 0) {
            message.embeds = [...(message.embeds || []), ...validPreviews];
          }
        } catch (err) {
          console.error('URL Preview error:', err);
        }
      }

      await message.save();
      await message.populate('author', 'username avatar activity');
      if (message.replyTo) {
        await message.populate({
          path: 'replyTo',
          populate: { path: 'author', select: 'username avatar activity' }
        });
      }

      if (data.channelId) {
        const fullMessage = await Message.findById(message._id)
          .populate('author', 'username avatar activity')
          .populate('mentions', 'username')
          .populate({
            path: 'replyTo',
            populate: { path: 'author', select: 'username avatar activity' }
          });
        io.to(`channel-${data.channelId}`).emit('new-message', fullMessage);

        // Specifically notify mentioned users if they are not in the channel
        message.mentions.forEach(userId => {
          if (String(userId) !== String(socket.userId)) {
            io.to(`user-${userId}`).emit('mention', fullMessage);
          }
        });
      }
      else if (data.dmId) {
        const DirectMessage = require('./models/DirectMessage');
        const dm = await DirectMessage.findById(data.dmId).populate('participants');
        if (dm) dm.participants.forEach(p => io.to(`user-${p._id}`).emit('new-message', message));
      }
        if (typeof callback === 'function') callback({ messageId: message._id });
      } catch (error) { socket.emit('error', { message: 'Failed to send message' }); }
  });

  socket.on('interactive-button-click', async (data) => {
    try {
      const { messageId, actionId, channelId } = data;
      if (!channelId || !messageId || !actionId) return;

      const userPayload = { _id: socket.user?._id, username: socket.user?.username };
      io.to(`channel-${channelId}`).emit('interactive-button-click', {
        messageId,
        actionId,
        channelId,
        user: userPayload
      });
    } catch (err) {
      console.error('interative-button-click error:', err);
    }
  });

  socket.on('edit-message', async (data) => {
    try {
      const { messageId, content } = data;
      const message = await Message.findById(messageId);
      if (!message) return;

      if (message.author.toString() !== socket.userId.toString()) {
        return socket.emit('error', { message: 'You can only edit your own messages' });
      }

      message.content = content !== undefined ? content : message.content;
      if (data.embeds) message.embeds = data.embeds;
      
      // Re-extract URL Previews on edit if content changed
      if (content !== undefined) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.content ? message.content.match(urlRegex) : null;
        if (urls && urls.length > 0) {
          try {
            const { getUrlPreview } = require('./utils/urlPreview');
            const uniqueUrls = [...new Set(urls)];
            const previewPromises = uniqueUrls.slice(0, 3).map(getUrlPreview);
            const previews = await Promise.all(previewPromises);
            const validPreviews = previews.filter(p => p !== null);
            if (validPreviews.length > 0) {
              message.embeds = [...(message.embeds || []), ...validPreviews];
            }
          } catch (err) { }
        }
      }

      if (data.buttons) message.buttons = data.buttons;
      message.edited = true;
      message.editedAt = new Date();
      await message.save();
      await message.populate('author', 'username avatar activity');
      await message.populate('mentions', 'username');

      if (message.channel) {
        io.to(`channel-${message.channel}`).emit('message-updated', message);
      } else if (message.directMessage) {
        const DirectMessage = require('./models/DirectMessage');
        const dm = await DirectMessage.findById(message.directMessage);
        if (dm) dm.participants.forEach(p => io.to(`user-${p._id}`).emit('message-updated', message));
      }
    } catch (error) { socket.emit('error', { message: 'Failed to edit message' }); }
  });

  socket.on('delete-message', async (data) => {
    try {
      const { messageId, channelId } = data;
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const isAuthor = String(msg.author) === String(socket.userId);
      let canDelete = isAuthor;

      if (!isAuthor && channelId) {
        const channel = await Channel.findById(channelId);
        if (channel) {
          const server = await Server.findById(channel.server);
          if (server) {
            const perms = computePermissions(socket.userId, server, channel);
            if (hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
              canDelete = true;
            }
          }
        }
      }

      if (canDelete) {
        await Message.findByIdAndDelete(messageId);
        if (channelId) io.to(`channel-${channelId}`).emit('message-deleted', messageId);
        else if (msg.directMessage) {
          const dm = await require('./models/DirectMessage').findById(msg.directMessage);
          if (dm) dm.participants.forEach(p => io.to(`user-${p}`).emit('message-deleted', messageId));
        }
      } else socket.emit('error', { message: 'Insufficient permissions' });
    } catch (error) { }
  });

  socket.on('typing-start', (data) => socket.to(`channel-${data.channelId}`).emit('user-typing', { userId: socket.userId, channelId: data.channelId }));
  socket.on('typing-stop', (data) => socket.to(`channel-${data.channelId}`).emit('user-stopped-typing', { userId: socket.userId, channelId: data.channelId }));

  socket.on('activity-update', async (activity) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) return;

      // Enrich with SteamGridDB icons if it's a game and icons are missing OR remote
      if (activity && activity.name && (!activity.assets || !activity.assets.largeImage || activity.assets.largeImage.startsWith('http'))) {
        try {
          const { getGameIcon } = require('./utils/steamGridDB');
          const iconUrl = await getGameIcon(activity.name);
          if (iconUrl) {
            if (!activity.assets) activity.assets = {};
            activity.assets.largeImage = iconUrl;
          }
        } catch (enrichErr) {
          console.error('Activity enrichment error:', enrichErr);
        }
      }

      await User.findByIdAndUpdate(user._id, { activity });
      io.emit('user-updated', { _id: user._id, activity });
    } catch (err) { }
  });

  socket.on('call-offer', async (data) => {
    const user = await User.findById(socket.userId);
    if (user && user.isBanned) {
      if (user.banExpires && user.banExpires < Date.now()) {
        user.isBanned = false;
        user.banExpires = undefined;
        user.banReason = undefined;
        await user.save();
      } else {
        return socket.emit('error', { message: 'Ваш аккаунт заблокирован. Звонки запрещены.' });
      }
    }

    if (data.dmId && !data.targetUserId) {
      // Group call offer
      try {
        const DirectMessage = require('./models/DirectMessage');
        const dm = await DirectMessage.findById(data.dmId);
        if (dm) {
          console.log(`[Call] Group offer from ${socket.userId} in DM ${data.dmId}`);
          dm.participants.forEach(p => {
            if (String(p) !== String(socket.userId)) {
              io.to(`user-${String(p)}`).emit('call-offer', {
                fromUserId: String(socket.userId),
                offer: data.offer,
                dmId: data.dmId,
                isGroup: true
              });
            }
          });
        }
      } catch (err) { }
    } else {
      console.log(`[Call] Offer from ${socket.userId} to ${data.targetUserId}`);
      io.to(`user-${String(data.targetUserId)}`).emit('call-offer', { fromUserId: String(socket.userId), offer: data.offer, dmId: data.dmId });
    }
  });

  socket.on('call-end', async (data) => {
    if (data.dmId && !data.targetUserId) {
      // Notify all in DM room
      io.to(`dm-call-${data.dmId}`).emit('call-end', { fromUserId: socket.userId });
    } else {
      console.log(`[Call] End from ${socket.userId} to ${data.targetUserId}`);
      io.to(`user-${data.targetUserId}`).emit('call-end');
    }
  });

  socket.on('join-dm-call', (data) => {
    console.log(`[Call] User ${socket.userId} joined DM room ${data.dmId}`);
    socket.join(`dm-call-${data.dmId}`);
    socket.dmCallId = data.dmId;
    socket.to(`dm-call-${data.dmId}`).emit('dm-call-user-joined', { userId: socket.userId });
    const room = io.sockets.adapter.rooms.get(`dm-call-${data.dmId}`);
    const existing = [];
    if (room) {
      for (const sid of room) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.userId && s.userId !== socket.userId) existing.push(String(s.userId));
      }
    }
    socket.emit('dm-call-existing-users', existing);
    socket.emit('voice-presences-snapshot', {
      channelId: `call-${data.dmId}`,
      presences: getPresencesSnapshot(`call-${data.dmId}`),
    });
  });

  // --- Voice presence lifecycle ---
  // The mini-app sends a "channelHint" — either the LiveKit room name (e.g.
  // "call-<dmId>" or "channel-<id>") — and the server validates the user is
  // actually in that room before broadcasting.

  function presenceSocketRoom(channelId) {
    if (channelId.startsWith('call-')) return 'dm-call-' + channelId.slice(5);
    if (channelId.startsWith('channel-')) return 'voice-channel-' + channelId.slice(8);
    return null;
  }
  function userIsInPresenceChannel(s, channelId) {
    if (channelId.startsWith('call-')) return s.dmCallId === channelId.slice(5);
    if (channelId.startsWith('channel-')) return String(s.voiceChannelId) === channelId.slice(8);
    return false;
  }

  socket.on('voice-presence-create', (data) => {
    const { sessionId, channelId, displayName, avatar } = data || {};
    if (!sessionId || !channelId || !userIsInPresenceChannel(socket, channelId)) return;
    const room = presenceSocketRoom(channelId);
    if (!room) return;
    const presence = {
      sessionId, channelId,
      ownerUserId: String(socket.userId),
      displayName: displayName || 'Мини-приложение',
      avatar: avatar || null,
      background: null,
      controls: [],
    };
    setPresence(channelId, presence);
    io.to(room).emit('voice-presence-added', presence);
    if (typeof socket._ownedPresences !== 'object') socket._ownedPresences = new Set();
    socket._ownedPresences.add(sessionId + '|' + channelId);
  });

  socket.on('voice-presence-update', (data) => {
    const { sessionId, channelId, patch } = data || {};
    const m = voicePresencesByChannel.get(String(channelId));
    const presence = m?.get(sessionId);
    if (!presence || presence.ownerUserId !== String(socket.userId)) return;
    if (patch.background !== undefined) presence.background = patch.background;
    if (patch.subtitle !== undefined) presence.subtitle = patch.subtitle;
    if (patch.accentColor !== undefined) presence.accentColor = patch.accentColor;
    if (patch.displayName !== undefined) presence.displayName = patch.displayName;
    if (patch.avatar !== undefined) presence.avatar = patch.avatar;
    if (Array.isArray(patch.controls)) presence.controls = patch.controls;
    if (patch.controlPatch) {
      const ctrl = (presence.controls || []).find(c => c.id === patch.controlPatch.id);
      if (ctrl) Object.assign(ctrl, patch.controlPatch.partial || {});
    }
    const room = presenceSocketRoom(channelId);
    if (room) io.to(room).emit('voice-presence-updated', presence);
  });

  socket.on('voice-presence-destroy', (data) => {
    const { sessionId, channelId } = data || {};
    const m = voicePresencesByChannel.get(String(channelId));
    const presence = m?.get(sessionId);
    if (!presence || presence.ownerUserId !== String(socket.userId)) return;
    removePresence(channelId, sessionId);
    const room = presenceSocketRoom(channelId);
    if (room) io.to(room).emit('voice-presence-removed', { sessionId, channelId });
    socket._ownedPresences?.delete(sessionId + '|' + channelId);
  });

  // Any voice-channel member can send a control — forwarded to the presence owner.
  socket.on('voice-presence-control', (data) => {
    const { sessionId, channelId, controlId, value } = data || {};
    if (!userIsInPresenceChannel(socket, channelId)) return;
    const presence = voicePresencesByChannel.get(String(channelId))?.get(sessionId);
    if (!presence) return;
    io.to(`user-${presence.ownerUserId}`).emit('voice-presence-control', {
      sessionId, channelId, controlId, value, fromUserId: String(socket.userId),
    });
  });

  socket.on('leave-dm-call', (data) => {
    cleanupUserPresencesInChannel('call-' + data.dmId, socket.userId, io);
    console.log(`[Call] User ${socket.userId} left DM room ${data.dmId}`);
    socket.leave(`dm-call-${data.dmId}`);
    socket.dmCallId = null;
    socket.to(`dm-call-${data.dmId}`).emit('dm-call-user-left', { userId: socket.userId });
  });

  socket.on('join-voice-channel', async (data) => {
    try {
      const user = await User.findById(socket.userId);
      if (user && user.isBanned) {
        if (user.banExpires && user.banExpires < Date.now()) {
          user.isBanned = false;
          user.banExpires = undefined;
          user.banReason = undefined;
          await user.save();
        } else {
          return socket.emit('error', { message: 'Ваш аккаунт заблокирован. Доступ в голосовые каналы запрещен.' });
        }
      }

      const channelId = data.channelId;
      const channel = await Channel.findById(channelId);
      if (!channel) return;

      const fullServer = await Server.findById(channel.server);
      const perms = computePermissions(socket.userId, fullServer, channel);
      if (!hasPermission(perms, Permissions.CONNECT)) {
        socket.emit('error', { message: 'No permission to connect to this channel' });
        return;
      }

      if (socket.voiceChannelId && socket.voiceChannelId !== channelId) {
        socket.leave(`voice-channel-${socket.voiceChannelId}`);
        io.to(`voice-channel-${socket.voiceChannelId}`).emit('voice-user-left', { userId: socket.userId });
        await notifyVoiceChannelUpdate(socket.voiceChannelId);
      }
      const existingUsers = await getVoiceChannelUsers(channelId);
      socket.join(`voice-channel-${channelId}`); socket.voiceChannelId = channelId;
      socket.emit('voice-presences-snapshot', { channelId, presences: getPresencesSnapshot(channelId) });
      // user is already declared above
      const memberRec = (fullServer.members || []).find(m => String(m.user) === String(socket.userId));
      const serverNickname = memberRec?.nickname || null;
      socket.to(`voice-channel-${channelId}`).emit('voice-user-joined', {
        userId: socket.userId,
        user: {
          _id: user._id,
          username: user.username,
          nickname: serverNickname,
          avatar: user.avatar,
          banner: user.banner,
          badges: user.badges || [],
          isMuted: socket.isMuted || false,
          isDeafened: socket.isDeafened || false,
          isScreenSharing: socket.isScreenSharing || false,
          isServerMuted: socket.isServerMuted || false,
          isServerDeafened: socket.isServerDeafened || false
        }
      });
      socket.emit('voice-existing-users', existingUsers);
      socket.emit('voice-server-state-update', {
        isServerMuted: socket.isServerMuted || false,
        isServerDeafened: socket.isServerDeafened || false,
        myNickname: serverNickname,
      });
      await notifyVoiceChannelUpdate(channelId);
      const ch = await Channel.findById(channelId);
      if (ch && ch.server) io.to(`server-${ch.server}`).emit('voice-channel-users-update', { channelId, users: await getVoiceChannelUsers(channelId) });

      // Sync YouTube state if active
      if (voiceChannelYouTubeStates.has(channelId)) {
        socket.emit('yt-watch-state', voiceChannelYouTubeStates.get(channelId));
      }
    } catch (e) { console.error('Join voice error', e); }
  });

  socket.on('yt-watch-start', (data) => {
    const { channelId, youtubeId } = data;
    if (!channelId || !youtubeId) return;
    const state = { youtubeId, currentTime: 0, playing: true, lastUpdated: Date.now(), hostId: socket.userId };
    voiceChannelYouTubeStates.set(channelId, state);
    io.to(`voice-channel-${channelId}`).emit('yt-watch-state', state);
  });

  socket.on('yt-watch-sync', (data) => {
    const { channelId, state } = data;
    if (!channelId || !state) return;
    const currentState = voiceChannelYouTubeStates.get(channelId);
    if (!currentState) return;
    
    // Update state
    currentState.currentTime = state.currentTime;
    currentState.playing = state.playing;
    currentState.lastUpdated = Date.now();
    
    // Broadcast to others
    socket.to(`voice-channel-${channelId}`).emit('yt-watch-state', currentState);
  });

  socket.on('yt-watch-stop', (data) => {
    const { channelId } = data;
    if (!channelId) return;
    voiceChannelYouTubeStates.delete(channelId);
    io.to(`voice-channel-${channelId}`).emit('yt-watch-state', null);
  });

  socket.on('admin-voice-kick', async (data) => {
    try {
      const { userId, channelId } = data;
      const ch = await Channel.findById(channelId);
      if (!ch) return;
      const server = await Server.findById(ch.server);
      if (!server) return;

      const perms = computePermissions(socket.userId, server);
      if (!hasPermission(perms, Permissions.MOVE_MEMBERS)) return;

      const connections = io.sockets.adapter.rooms.get(`user-${userId}`);
      if (connections) {
        for (const sid of connections) {
          const s = io.sockets.sockets.get(sid);
          if (s && s.voiceChannelId === channelId) {
            s.emit('force-disconnect-voice');
            s.leave(`voice-channel-${channelId}`);
            s.voiceChannelId = null;
            io.to(`voice-channel-${channelId}`).emit('voice-user-left', { userId });
            await notifyVoiceChannelUpdate(channelId);
            
            await logAction({
              serverId: ch.server,
              executorId: socket.userId,
              targetId: userId,
              targetModel: 'User',
              action: 'MEMBER_VOICE_KICK',
              reason: `Kicked from voice channel #${ch.name}`
            });
          }
        }
      }
    } catch (e) { console.error('Voice kick error', e); }
  });

  socket.on('voice-state-update', async (data) => {
    if (!socket.voiceChannelId || socket.voiceChannelId !== data.channelId) return;

    // Audit self mute/deaf if changed
    if (socket.isMuted !== data.isMuted || socket.isDeafened !== data.isDeafened) {
      try {
        const channel = await Channel.findById(data.channelId);
        if (channel) {
          await logAction({
            serverId: channel.server,
            executorId: socket.userId,
            targetId: socket.userId,
            targetModel: 'User',
            action: 'MEMBER_VOICE_SELF_STATE',
            changes: [
              { key: 'isMuted', oldValue: socket.isMuted, newValue: data.isMuted },
              { key: 'isDeafened', oldValue: socket.isDeafened, newValue: data.isDeafened }
            ].filter(c => c.oldValue !== c.newValue)
          });
        }
      } catch (err) { }
    }

    socket.isMuted = data.isMuted; socket.isDeafened = data.isDeafened;
    socket.isScreenSharing = data.isScreenSharing || false;
    socket.to(`voice-channel-${data.channelId}`).emit('voice-user-state-update', {
      userId: socket.userId,
      isMuted: socket.isMuted,
      isDeafened: socket.isDeafened,
      isScreenSharing: socket.isScreenSharing,
      isServerMuted: socket.isServerMuted || false,
      isServerDeafened: socket.isServerDeafened || false
    });
    await notifyVoiceChannelUpdate(data.channelId);
  });

  socket.on('leave-voice-channel', async (data) => {
    const channelId = data.channelId;
    cleanupUserPresencesInChannel('channel-' + channelId, socket.userId, io);
    socket.leave(`voice-channel-${channelId}`);
    socket.voiceChannelId = null;
    io.to(`voice-channel-${channelId}`).emit('voice-user-left', { userId: socket.userId });
    await notifyVoiceChannelUpdate(channelId);

    const room = io.sockets.adapter.rooms.get(`voice-channel-${channelId}`);
    if (!room || room.size === 0) {
      voiceChannelYouTubeStates.delete(channelId);
    }
  });

  socket.on('admin-voice-move', async (data) => {
    try {
      const { userId, channelId } = data;
      const targetChannel = await Channel.findById(channelId);
      if (!targetChannel) return;
      const server = await Server.findById(targetChannel.server);
      if (!server) return;

      const perms = computePermissions(socket.userId, server);
      if (!hasPermission(perms, Permissions.MOVE_MEMBERS)) return;

      const connections = io.sockets.adapter.rooms.get(`user-${userId}`);
      if (connections) {
        for (const sid of connections) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.emit('force-join-voice', { channelId });
        }
      }
    } catch (e) { console.error('Move error', e); }
  });

  socket.on('admin-voice-mute', async (data) => {
    try {
      const { userId, muted, serverId } = data;
      const server = await Server.findById(serverId);
      if (!server) return;
      const perms = computePermissions(socket.userId, server);
      if (!hasPermission(perms, Permissions.MUTE_MEMBERS)) return;

      const connections = io.sockets.adapter.rooms.get(`user-${userId}`);
      if (connections) {
        for (const sid of connections) {
          const s = io.sockets.sockets.get(sid);
          if (s) {
            s.isServerMuted = muted;
            if (s.voiceChannelId) {
              io.to(`voice-channel-${s.voiceChannelId}`).emit('voice-user-state-update', {
                userId: userId,
                isMuted: s.isMuted,
                isDeafened: s.isDeafened,
                isScreenSharing: s.isScreenSharing,
                isServerMuted: s.isServerMuted,
                isServerDeafened: s.isServerDeafened
              });
              await notifyVoiceChannelUpdate(s.voiceChannelId);
            }
            s.emit('voice-server-state-update', { isServerMuted: muted, isServerDeafened: s.isServerDeafened });
          }
        }
        
        await logAction({
          serverId: serverId,
          executorId: socket.userId,
          targetId: userId,
          targetModel: 'User',
          action: 'MEMBER_VOICE_SERVER_MUTE',
          changes: [{ key: 'isServerMuted', newValue: muted }]
        });
      }
    } catch (e) { console.error('admin-voice-mute error:', e); }
  });

  socket.on('admin-voice-deafen', async (data) => {
    try {
      const { userId, deafened, serverId } = data;
      const server = await Server.findById(serverId);
      if (!server) return;
      const perms = computePermissions(socket.userId, server);
      if (!hasPermission(perms, Permissions.DEAFEN_MEMBERS)) return;

      const connections = io.sockets.adapter.rooms.get(`user-${userId}`);
      if (connections) {
        for (const sid of connections) {
          const s = io.sockets.sockets.get(sid);
          if (s) {
            s.isServerDeafened = deafened;
            if (s.voiceChannelId) {
              io.to(`voice-channel-${s.voiceChannelId}`).emit('voice-user-state-update', {
                userId: userId,
                isMuted: s.isMuted,
                isDeafened: s.isDeafened,
                isScreenSharing: s.isScreenSharing,
                isServerMuted: s.isServerMuted,
                isServerDeafened: s.isServerDeafened
              });
              await notifyVoiceChannelUpdate(s.voiceChannelId);
            }
            s.emit('voice-server-state-update', { isServerMuted: s.isServerMuted, isServerDeafened: deafened });
          }
        }
        
        await logAction({
          serverId: serverId,
          executorId: socket.userId,
          targetId: userId,
          targetModel: 'User',
          action: 'MEMBER_VOICE_SERVER_DEAFEN',
          changes: [{ key: 'isServerDeafened', newValue: deafened }]
        });
      }
    } catch (e) { console.error('admin-voice-deafen error:', e); }
  });

  socket.on('disconnect', async () => {
    if (socket.voiceChannelId) {
      const channelId = socket.voiceChannelId;
      cleanupUserPresencesInChannel('channel-' + channelId, socket.userId, io);
      io.to(`voice-channel-${channelId}`).emit('voice-user-left', { userId: socket.userId });
      await notifyVoiceChannelUpdate(channelId);

      const room = io.sockets.adapter.rooms.get(`voice-channel-${channelId}`);
      if (!room || room.size === 0) {
        voiceChannelYouTubeStates.delete(channelId);
      }
    }
    if (socket.dmCallId) cleanupUserPresencesInChannel('call-' + socket.dmCallId, socket.userId, io);
    cleanupUserPresencesEverywhere(socket.userId, io);
    const connections = io.sockets.adapter.rooms.get(`user-${String(socket.userId)}`);
    if (!connections || connections.size === 0) {
      try {
        const user = await User.findById(socket.userId);
        if (user) {
          user.status = 'offline'; user.activity = null; await user.save();
          io.emit('user-updated', { _id: user._id, status: 'offline', activity: null });
        }
      } catch (err) { }
    }
  });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/maxcord').then(async () => {
  console.log('Connected to MongoDB');
  try { await require('./bootstrap/systemMiniApps')(); }
  catch (e) { console.error('[MiniApps] bootstrap failed:', e.message); }
}).catch(err => { console.error('MongoDB connection error:', err); });
server.listen(process.env.PORT || 5000, () => { console.log(`Server running on port ${process.env.PORT || 5000}`); });
