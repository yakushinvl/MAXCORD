const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const upload = require('../middleware/upload');

const checkPermission = require('../middleware/checkPermission');
const { Permissions, DEFAULT_PERMISSIONS } = require('../utils/permissions');
const { computePermissions, getHighestRolePosition } = require('../utils/permissionCalculator');
const { logAction } = require('../utils/auditLogger');


router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name || name.trim().length === 0) return res.status(400).json({ message: 'Server name is required' });

    // Create @everyone role
    const everyoneRole = {
      name: '@everyone',
      color: '#99aab5',
      hoist: false,
      position: 0,
      permissions: DEFAULT_PERMISSIONS.toString(),
      mentionable: false
    };

    const server = new Server({
      name: name.trim(),
      description: description || '',
      icon: icon || null,
      owner: req.user._id,
      roles: [everyoneRole],
      members: [{
        user: req.user._id,
        roles: [] // Owner doesn't strictly need roles, but @everyone is implicit
      }]
    });

    await server.save();
    const generalChannel = new Channel({ name: 'general', type: 'text', server: server._id, position: 0 });
    await generalChannel.save();
    server.channels.push(generalChannel._id);
    await server.save();
    const user = await User.findById(req.user._id);
    if (user) {
      if (!user.servers) user.servers = [];
      if (!user.servers.includes(server._id)) { user.servers.push(server._id); await user.save(); }
    }
    const populatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    res.status(201).json(populatedServer);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let userServerIds = user?.servers || [];

    // Fallback if servers array is empty (common for bots or desynced state)
    if (userServerIds.length === 0) {
      const serversJoined = await Server.find({ 'members.user': req.user._id }, '_id');
      userServerIds = serversJoined.map(s => s._id);

      // Update the user document if it was desynced
      if (userServerIds.length > 0 && user) {
        user.servers = userServerIds;
        await user.save();
      }
    }

    const allServers = await Server.find({ _id: { $in: userServerIds } }).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity').sort({ createdAt: -1 });
    res.json(allServers);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    if (!server) return res.status(404).json({ message: 'Server not found' });
    res.json(server);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const isMember = server.members.some(member => member.user.toString() === req.user._id.toString());
    if (isMember) return res.status(400).json({ message: 'Already a member' });
    server.members.push({ user: req.user._id });
    await server.save();
    const user = await User.findById(req.user._id);
    if (!user.servers) user.servers = [];
    if (!user.servers.includes(server._id)) { user.servers.push(server._id); await user.save(); }
    const populatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    const io = req.app.get('io');
    if (io) {
      const newMember = populatedServer.members.find(m => m.user._id.toString() === req.user._id.toString());
      io.to(`server-${server._id}`).emit('server-member-joined', { serverId: server._id, member: newMember, server: populatedServer });
      io.to(`server-${server._id}`).emit('server-updated', populatedServer);
    }
    res.json(populatedServer);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Update server settings
router.put('/:id', auth, checkPermission(Permissions.MANAGE_GUILD), async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const { name, description, icon, banner, bannerColor } = req.body;
    if (name) server.name = name;
    if (description !== undefined) server.description = description;
    if (icon !== undefined) server.icon = icon;
    if (banner !== undefined) server.banner = banner;
    if (bannerColor !== undefined) server.bannerColor = bannerColor;
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: server._id,
      targetModel: 'Server',
      action: 'SERVER_UPDATE',
      changes: [
        { key: 'name', newValue: name },
        { key: 'description', newValue: description },
        { key: 'icon', newValue: icon },
        { key: 'banner', newValue: banner }
      ].filter(c => c.newValue !== undefined)
    });

    const populatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-updated', populatedServer);
    res.json(populatedServer);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Delete server
router.delete('/:id', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    // Only owner can delete server
    if (server.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the server owner can delete the server' });
    }

    await Channel.deleteMany({ server: server._id });
    const io = req.app.get('io');
    if (io) io.to(`server-${req.params.id}`).emit('server-deleted', { serverId: req.params.id });
    await Server.findByIdAndDelete(req.params.id);
    res.json({ message: 'Server deleted' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/icon', auth, checkPermission(Permissions.MANAGE_GUILD), upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const iconUrl = `/api/uploads/${req.file.filename}`;
    server.icon = iconUrl;
    await server.save();
    const io = req.app.get('io');
    if (io) {
      const updatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${server._id}`).emit('server-updated', updatedServer);
    }
    res.json({ icon: iconUrl });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/banner', auth, checkPermission(Permissions.MANAGE_GUILD), upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const bannerUrl = `/api/uploads/${req.file.filename}`;
    server.banner = bannerUrl;
    await server.save();
    const io = req.app.get('io');
    if (io) {
      const updatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${server._id}`).emit('server-updated', updatedServer);
    }
    res.json({ banner: bannerUrl });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ROLES ROUTES
router.get('/:id/roles', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    // AUTOMATIC REPAIR: Ensure all roles have names to pass validation
    let changed = false;
    server.roles.forEach((r, idx) => {
      if (!r.name) {
        r.name = idx === 0 ? '@everyone' : `Recovered Role ${idx}`;
        changed = true;
      }
    });

    // Ensure @everyone exists at the start
    let everyoneIdx = server.roles.findIndex(r => r.name === '@everyone');
    if (everyoneIdx === -1) {
      server.roles.unshift({
        name: '@everyone',
        color: '#99aab5',
        hoist: false,
        position: 0,
        permissions: DEFAULT_PERMISSIONS.toString()
      });
      changed = true;
    } else if (everyoneIdx > 0) {
      // Optional: move it to the front if it's not there
      const everyone = server.roles[everyoneIdx];
      server.roles.splice(everyoneIdx, 1);
      server.roles.unshift(everyone);
      changed = true;
    }

    if (changed) {
      console.log(`Repaired roles for server ${server._id}`);
      await server.save();
    }

    res.json(server.roles);
  } catch (error) {
    console.error('Roles GET error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update role positions
router.patch('/:id/roles/positions', auth, checkPermission(Permissions.MANAGE_ROLES), async (req, res) => {
  try {
    const { roles: rolePositions } = req.body; // [{ id, position }]
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    const actorHigh = getHighestRolePosition(req.user._id, server);

    // Validate: Access check
    for (const item of rolePositions) {
      const role = server.roles.id(item.id);
      if (!role) continue;
      // Cannot move roles if they are above you (unless owner)
      if (role.position >= actorHigh && String(server.owner) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Cannot move roles equal to or higher than your highest role' });
      }
      // Cannot move roles TO a position above you
      if (item.position >= actorHigh && String(server.owner) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Cannot move roles to a position higher than your highest role' });
      }
    }

    rolePositions.forEach(item => {
      const role = server.roles.id(item.id);
      if (role) role.position = item.position;
    });

    await server.save();

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-updated', await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity'));

    res.json(server.roles);
  } catch (error) {
    console.error('Role position update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/roles', auth, checkPermission(Permissions.MANAGE_ROLES), async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    const { name, color, hoist, permissions, mentionable } = req.body;

    // Fix existing roles that might be missing names to pass validation
    server.roles.forEach((role, index) => {
      if (!role || !role.name) {
        if (role) role.name = index === 0 ? '@everyone' : `Recovered Role ${index}`;
      }
    });

    const newRole = {
      name: name || 'New Role',
      color: color || '#99aab5',
      hoist: hoist || false,
      position: server.roles.length,
      permissions: permissions || DEFAULT_PERMISSIONS.toString(),
      mentionable: mentionable || false
    };

    server.roles.push(newRole);
    await server.save();
    const createdRole = server.roles[server.roles.length - 1];

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: createdRole._id,
      targetModel: 'Server', // Roles are subdocs, ref server
      action: 'ROLE_CREATE',
      changes: [{ key: 'name', newValue: createdRole.name }]
    });

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-updated', await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity'));

    res.status(201).json(server.roles[server.roles.length - 1]);
  } catch (error) {
    console.error('Role creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/roles/:roleId', auth, checkPermission(Permissions.MANAGE_ROLES), async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    // --- ULTRA-ROBUST ROLE LOOKUP ---
    let role;
    const roleIdStr = String(req.params.roleId);

    // 1. Try standard Mongoose subdocument lookup
    try {
      role = server.roles.id(req.params.roleId);
    } catch (e) { }

    // 2. Manual search by ID string
    if (!role) {
      role = server.roles.find(r => String(r._id) === roleIdStr);
    }

    // 3. Special handling for @everyone aliases and ID mismatches
    if (!role) {
      const isEveryoneAlias = roleIdStr === 'everyone' || roleIdStr === '0' || roleIdStr.length < 5;

      // Final fallback: If we can't find by ID, but there is an @everyone role,
      // and this is either a known alias OR we're just desperate to find the base role
      role = server.roles.find(r => r.name === '@everyone');

      if (role) {
        console.log(`[DEBUG] Role ${roleIdStr} not found by ID, but using @everyone by name fallback.`);
      }
    }

    if (!role) {
      console.error(`Update role error: Role ${roleIdStr} absolutely not found on server ${server._id}`);
      return res.status(404).json({ message: 'Role not found' });
    }

    console.log(`[DEBUG] Found role to update: ${role.name} (${role._id})`);


    // Hierarchy check: Cannot edit role if it's higher/equal to yours
    const actorHigh = getHighestRolePosition(req.user._id, server);
    if (role.position >= actorHigh && String(server.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Insufficient permissions to manage this role' });
    }

    if (role.name === '@everyone' && req.body.name) return res.status(400).json({ message: 'Cannot rename @everyone role' });

    const fields = ['name', 'color', 'hoist', 'position', 'permissions', 'mentionable'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) role[field] = req.body[field];
    });

    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: role._id,
      targetModel: 'Server',
      action: 'ROLE_UPDATE',
      changes: Object.keys(req.body).map(k => ({ key: k, newValue: req.body[k] }))
    });

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-updated', await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity'));

    res.json(role);
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/roles/:roleId', auth, checkPermission(Permissions.MANAGE_ROLES), async (req, res) => {
  try {
    console.log(`Attempting to delete role ${req.params.roleId} from server ${req.params.id}`);

    const server = await Server.findById(req.params.id);
    if (!server) {
      console.error('Delete role error: Server not found');
      return res.status(404).json({ message: 'Server not found' });
    }

    // --- REPAIR STEP ---
    // Ensure ALL existing roles have a name, otherwise we can't save the server at all
    let namesFixed = false;
    server.roles.forEach((r, idx) => {
      if (!r.name) {
        r.name = idx === 0 ? '@everyone' : `Recovered Role ${idx}`;
        namesFixed = true;
      }
    });
    if (namesFixed) console.log('Fixed missing names for some roles to allow saving.');

    console.log('Available role IDs in DB:', server.roles.map(r => String(r._id || 'NO_ID')));

    // Robust role lookup
    let role = server.roles.id(req.params.roleId);
    if (!role) {
      role = server.roles.find(r => r && String(r._id || r) === String(req.params.roleId));
    }

    if (!role) {
      console.log(`Role ${req.params.roleId} not found in roles array. Attempting forced filter removal...`);
      const initialLength = server.roles.length;
      // Filter out anything that matches the ID string
      server.roles = server.roles.filter(r => r && String(r._id || r) !== String(req.params.roleId));

      if (server.roles.length < initialLength) {
        await server.save();
        const updatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
        const io = req.app.get('io');
        if (io) io.to(`server-${server._id}`).emit('server-updated', updatedServer);
        return res.json({ message: 'Role forcibly removed' });
      }

      console.error(`Delete role error: Role ${req.params.roleId} absolutely not found`);
      return res.status(404).json({ message: 'Role not found' });
    }


    // Hierarchy check
    const actorHigh = getHighestRolePosition(req.user._id, server);
    if (role.position >= actorHigh && String(server.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Insufficient permissions to delete this role' });
    }

    if (role.name === '@everyone') return res.status(400).json({ message: 'Cannot delete @everyone role' });

    // Remove role from all members
    server.members.forEach(member => {
      if (member.roles) {
        member.roles = member.roles.filter(r => String(r) !== String(req.params.roleId));
      }
    });

    server.roles.pull(req.params.roleId);
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: server._id,
      targetModel: 'Server',
      action: 'ROLE_DELETE',
      reason: `Deleted role ${role.name}`
    });

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-updated', await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity'));

    res.json({ message: 'Role deleted' });
  } catch (error) {
    console.error('Role deletion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/update-member-roles', auth, checkPermission(Permissions.MANAGE_ROLES), async (req, res) => {
  try {
    const { userId, roles } = req.body;
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    const member = server.members.find(m => m.user.toString() === userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    member.roles = roles;
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: userId,
      targetModel: 'User',
      action: 'MEMBER_UPDATE',
      changes: [{ key: 'roles', newValue: roles }]
    });

    const populatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    const updatedMember = populatedServer.members.find(m => m.user._id.toString() === userId);

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-member-updated', { serverId: server._id, member: updatedMember });

    res.json(updatedMember);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id/members/:userId', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const member = server.members.find(m => m.user.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Update member profile (nickname, roles, etc.)
router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    const memberIndex = server.members.findIndex(m => m.user.toString() === req.params.userId);
    if (memberIndex === -1) return res.status(404).json({ message: 'Member not found' });

    const { nickname, bio, avatar, banner, roles } = req.body;
    const isSelf = req.user._id.toString() === req.params.userId;
    const userPerms = computePermissions(req.user._id, server);

    // Hierarchy Check (if modifying someone else)
    if (!isSelf && String(server.owner) !== String(req.user._id)) {
      const actorHigh = getHighestRolePosition(req.user._id, server);
      const targetHigh = getHighestRolePosition(req.params.userId, server);
      if (targetHigh >= actorHigh) {
        return res.status(403).json({ message: 'You cannot manage this user (hierarchy)' });
      }
    }

    // Permission checks
    if (nickname !== undefined && nickname !== server.members[memberIndex].nickname) {
      const canChangeSelf = isSelf && (userPerms & Permissions.CHANGE_NICKNAME);
      const canManageOthers = (userPerms & Permissions.MANAGE_NICKNAMES);
      if (!canChangeSelf && !canManageOthers && String(server.owner) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Insufficient permissions to change nickname' });
      }
      server.members[memberIndex].nickname = nickname;
    }

    if (roles !== undefined) {
      if (!(userPerms & Permissions.MANAGE_ROLES) && String(server.owner) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Insufficient permissions to manage roles' });
      }

      // Ensure user isn't assigning roles higher than their own (if not owner)
      if (String(server.owner) !== String(req.user._id)) {
        const actorHigh = getHighestRolePosition(req.user._id, server);
        const addedRoles = roles.filter(r => !(server.members[memberIndex].roles || []).includes(r));

        for (const rid of addedRoles) {
          const r = server.roles.id(rid);
          if (r && r.position >= actorHigh) {
            return res.status(403).json({ message: 'Cannot assign a role higher or equal to your own' });
          }
        }
      }

      server.members[memberIndex].roles = roles;
    }

    if (bio !== undefined) server.members[memberIndex].bio = bio;
    if (avatar !== undefined) server.members[memberIndex].avatar = avatar;
    if (banner !== undefined) server.members[memberIndex].banner = banner;

    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: req.params.userId,
      targetModel: 'User',
      action: 'MEMBER_UPDATE',
      changes: Object.keys(req.body).map(k => ({ key: k, newValue: req.body[k] }))
    });

    const updatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-member-updated', { serverId: server._id, member: updatedServer.members[memberIndex] });
    res.json(updatedServer.members[memberIndex]);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    server.members = server.members.filter(m => m.user.toString() !== req.params.userId);

    // Hierarchy Check
    if (String(server.owner) !== String(req.user._id)) {
      const actorHigh = getHighestRolePosition(req.user._id, server);
      const targetHigh = getHighestRolePosition(req.params.userId, server);
      if (targetHigh >= actorHigh) {
        return res.status(403).json({ message: 'Cannot kick user with equal or higher role' });
      }
    }
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: req.params.userId,
      targetModel: 'User',
      action: 'MEMBER_KICK'
    });

    const user = await User.findById(req.params.userId);
    if (user) { user.servers = user.servers.filter(s => s.toString() !== server._id.toString()); await user.save(); }
    const io = req.app.get('io');
    if (io) {
      io.to(`server-${req.params.id}`).emit('server-member-left', { serverId: req.params.id, userId: req.params.userId });
      const updatedServer = await Server.findById(req.params.id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${req.params.id}`).emit('server-updated', updatedServer);
    }
    res.json({ message: 'Member removed' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/:id/leave', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    // Owners cannot leave their own server - they must delete it or transfer ownership
    if (server.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owners cannot leave their own server' });
    }

    // Remove from server members
    server.members = server.members.filter(m => m.user.toString() !== req.user._id.toString());
    await server.save();

    // Remove from user's servers list
    const user = await User.findById(req.user._id);
    if (user) {
      user.servers = user.servers.filter(s => s.toString() !== server._id.toString());
      await user.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`server-${req.params.id}`).emit('server-member-left', { serverId: req.params.id, userId: req.user._id });
      const updatedServer = await Server.findById(req.params.id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${req.params.id}`).emit('server-updated', updatedServer);
    }

    res.json({ message: 'Left server successfully' });
  } catch (error) {
    console.error('Leave server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/bans', auth, checkPermission(Permissions.BAN_MEMBERS), async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    // Validate target is not owner
    if (String(server.owner) === String(userId)) return res.status(403).json({ message: 'Cannot ban the owner' });

    // Hierarchy Check
    if (String(server.owner) !== String(req.user._id)) {
      const actorHigh = getHighestRolePosition(req.user._id, server);
      const targetHigh = getHighestRolePosition(userId, server);
      if (targetHigh >= actorHigh) {
        return res.status(403).json({ message: 'Cannot ban user with equal or higher role' });
      }
    }

    // Check if already banned
    const isBanned = server.bans.some(b => String(b.user) === String(userId));
    if (isBanned) return res.status(400).json({ message: 'User is already banned' });

    server.bans.push({ user: userId, reason });
    server.members = server.members.filter(m => String(m.user) !== String(userId));
    await server.save();

    await logAction({
      serverId: server._id,
      executorId: req.user._id,
      targetId: userId,
      targetModel: 'User',
      action: 'MEMBER_BAN',
      reason
    });

    const user = await User.findById(userId);
    if (user) {
      user.servers = user.servers.filter(s => String(s) !== String(server._id));
      await user.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`server-${server._id}`).emit('server-member-left', { serverId: server._id, userId: userId });
      const updatedServer = await Server.findById(server._id).populate('owner', 'username avatar badges').populate('channels').populate('members.user', 'username avatar status badges activity');
      io.to(`server-${server._id}`).emit('server-updated', updatedServer);
    }

    res.json({ message: 'User banned' });
  } catch (error) {
    console.error('Ban error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/emojis', auth, checkPermission(Permissions.MANAGE_GUILD), upload.single('emoji'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!req.file || !name) return res.status(400).json({ message: 'File and name required' });

    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    const emojiUrl = `/api/uploads/${req.file.filename}`;
    const newEmoji = {
      name,
      url: emojiUrl,
      id: Math.random().toString(36).substring(2, 11),
      animated: req.file.mimetype === 'image/gif',
      author: req.user._id
    };

    if (!server.emojis) server.emojis = [];
    server.emojis.push(newEmoji);
    await server.save();

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-emojis-updated', { serverId: server._id, emojis: server.emojis });

    res.status(201).json(newEmoji);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id/emojis/:emojiId', auth, checkPermission(Permissions.MANAGE_GUILD), async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ message: 'Server not found' });

    server.emojis = server.emojis.filter(e => e.id !== req.params.emojiId);
    await server.save();

    const io = req.app.get('io');
    if (io) io.to(`server-${server._id}`).emit('server-emojis-updated', { serverId: server._id, emojis: server.emojis });

    res.json({ message: 'Emoji deleted' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id/audit-logs', auth, checkPermission(Permissions.VIEW_AUDIT_LOG), async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const query = { server: req.params.id };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('executor', 'username avatar')
      .populate({
        path: 'target',
        select: 'username name content' // Select relevant fields for different target types
      });

    res.json(logs);
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

