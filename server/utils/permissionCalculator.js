const { Permissions, DEFAULT_PERMISSIONS } = require('./permissions');

/**
 * Calculates effective permissions for a user in a server (and optionally a channel)
 * @param {Object} user User object or User ID
 * @param {Object} server Server object (must include members and roles)
 * @param {Object} [channel] Channel object (optional, for channel-specific overwrites)
 */
function computePermissions(userId, server, channel = null) {
    userId = String(userId);

    // 1. Owner has all permissions
    if (String(server.owner) === userId) {
        return Object.values(Permissions).reduce((acc, p) => acc | p, 0n);
    }

    // Find member in server
    if (!server.members || !Array.isArray(server.members)) return 0n;
    const member = server.members.find(m => m && m.user && String(m.user._id || m.user) === userId);
    if (!member) return 0n;

    // 2. Start with @everyone permissions (baseline)
    // In Discord, the first role in the roles array is usually @everyone
    let basePermissions = DEFAULT_PERMISSIONS;
    const everyoneRole = server.roles.find(r => r.name === '@everyone');
    if (everyoneRole) {
        basePermissions = BigInt(everyoneRole.permissions || '0');
    }

    // 3. Add permissions from all user roles
    let permissions = basePermissions;
    const memberRoleIds = (member.roles || []).map(r => String(r));
    const memberRoles = (server.roles || []).filter(r => r && memberRoleIds.includes(String(r._id)));

    for (const role of memberRoles) {
        permissions |= BigInt(role.permissions || '0');
    }

    // 4. If Administrator is present, they have all perms
    if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
        return Object.values(Permissions).reduce((acc, p) => acc | p, 0n);
    }

    // 5. Channel-specific overwrites
    if (channel) {
        // a. @everyone overwrite
        const everyoneOverwrite = (channel.permissionOverwrites || []).find(o => String(o.id) === String(server._id || server) || (everyoneRole && String(o.id) === String(everyoneRole._id)));
        if (everyoneOverwrite) {
            permissions &= ~BigInt(everyoneOverwrite.deny || '0');
            permissions |= BigInt(everyoneOverwrite.allow || '0');
        }

        // b. Role overwrites
        let roleAllow = 0n;
        let roleDeny = 0n;
        for (const roleId of memberRoleIds) {
            const overwrite = (channel.permissionOverwrites || []).find(o => String(o.id) === roleId);
            if (overwrite) {
                roleAllow |= BigInt(overwrite.allow || '0');
                roleDeny |= BigInt(overwrite.deny || '0');
            }
        }
        permissions &= ~roleDeny;
        permissions |= roleAllow;

        // c. Member overwrite
        const memberOverwrite = (channel.permissionOverwrites || []).find(o => String(o.id) === userId);
        if (memberOverwrite) {
            permissions &= ~BigInt(memberOverwrite.deny || '0');
            permissions |= BigInt(memberOverwrite.allow || '0');
        }
    }

    return permissions;
}

/**
 * Checks if a user has a specific permission
 * @param {BigInt} userPerms The calculated permissions of the user
 * @param {BigInt} requiredPerm The permission bit to check
 */
function hasPermission(userPerms, requiredPerm) {
    if ((userPerms & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
    return (userPerms & requiredPerm) === requiredPerm;
}

function getHighestRolePosition(userId, server) {
    if (String(server.owner) === String(userId)) return Infinity;

    const member = server.members.find(m => String(m.user._id || m.user) === String(userId));
    if (!member) return -1;

    let maxPos = 0;
    const memberRoleIds = (member.roles || []).map(r => String(r));
    const memberRoles = (server.roles || []).filter(r => memberRoleIds.includes(String(r._id)));

    for (const role of memberRoles) {
        if (role.position > maxPos) maxPos = role.position;
    }
    return maxPos;
}

module.exports = {
    computePermissions,
    hasPermission,
    getHighestRolePosition
};
