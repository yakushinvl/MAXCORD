export const Permissions = {
    // General Permissions
    CREATE_INSTANT_INVITE: 1n << 0n,
    KICK_MEMBERS: 1n << 1n,
    BAN_MEMBERS: 1n << 2n,
    ADMINISTRATOR: 1n << 3n,
    MANAGE_CHANNELS: 1n << 4n,
    MANAGE_GUILD: 1n << 5n,
    VIEW_AUDIT_LOG: 1n << 7n,
    VIEW_CHANNEL: 1n << 10n,

    // Text Permissions
    SEND_MESSAGES: 1n << 11n,
    MANAGE_MESSAGES: 1n << 13n,
    EMBED_LINKS: 1n << 14n,
    ATTACH_FILES: 1n << 15n,
    READ_MESSAGE_HISTORY: 1n << 16n,
    MENTION_EVERYONE: 1n << 17n,
    ADD_REACTIONS: 1n << 20n,
    PIN_MESSAGES: 1n << 25n,

    // Voice Permissions
    CONNECT: 1n << 21n,
    SPEAK: 1n << 22n,
    STREAM: 1n << 23n,
    PRIORITY_SPEAKER: 1n << 24n,
    MUTE_MEMBERS: 1n << 26n,
    DEAFEN_MEMBERS: 1n << 27n,
    MOVE_MEMBERS: 1n << 28n,

    // Membership
    CHANGE_NICKNAME: 1n << 31n,
    MANAGE_NICKNAMES: 1n << 32n,
    MANAGE_ROLES: 1n << 33n,
};

export const DEFAULT_PERMISSIONS =
    Permissions.VIEW_CHANNEL |
    Permissions.SEND_MESSAGES |
    Permissions.READ_MESSAGE_HISTORY |
    Permissions.CONNECT |
    Permissions.SPEAK |
    Permissions.STREAM |
    Permissions.CHANGE_NICKNAME |
    Permissions.CREATE_INSTANT_INVITE |
    Permissions.ADD_REACTIONS;

export function computePermissions(userId: string, server: any, channel: any = null): bigint {
    if (!server || !userId) return 0n;

    const uId = String(userId);
    const ownerId = typeof server.owner === 'object' ? String(server.owner._id) : String(server.owner);

    // 1. Owner has all permissions
    if (uId === ownerId) {
        return Object.values(Permissions).reduce((acc, p) => acc | p, 0n);
    }

    // Find member
    const member = server.members.find((m: any) => String(m.user._id || m.user) === uId);
    if (!member) return 0n;

    // 2. Start with @everyone
    let permissions = 0n;
    // @everyone role usually has the same ID as the server, or name '@everyone'
    const everyoneRole = server.roles.find((r: any) => r.name === '@everyone' || String(r._id) === String(server._id));
    if (everyoneRole) {
        permissions = BigInt(everyoneRole.permissions || 0n);
    } else {
        permissions = DEFAULT_PERMISSIONS;
    }

    // 3. Roles
    const memberRoleIds = (member.roles || []).map((id: any) => String(id));
    const memberRoles = server.roles.filter((r: any) => memberRoleIds.includes(String(r._id)));

    for (const role of memberRoles) {
        permissions |= BigInt(role.permissions || 0n);
    }

    // 4. Admin
    if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
        return Object.values(Permissions).reduce((acc, p) => acc | p, 0n);
    }

    // 5. Channel Overwrites
    if (channel && channel.permissionOverwrites) {
        // @everyone overwrite
        const everyoneOverwrite = channel.permissionOverwrites.find((o: any) => String(o.id) === String(server._id));
        if (everyoneOverwrite) {
            permissions &= ~BigInt(everyoneOverwrite.deny || 0n);
            permissions |= BigInt(everyoneOverwrite.allow || 0n);
        }

        // Roles overwrites
        let roleAllow = 0n;
        let roleDeny = 0n;
        for (const roleId of memberRoleIds) {
            const overwrite = channel.permissionOverwrites.find((o: any) => String(o.id) === String(roleId));
            if (overwrite) {
                roleAllow |= BigInt(overwrite.allow || 0n);
                roleDeny |= BigInt(overwrite.deny || 0n);
            }
        }
        permissions &= ~roleDeny;
        permissions |= roleAllow;

        // Member overwrite
        const memberOverwrite = channel.permissionOverwrites.find((o: any) => String(o.id) === uId);
        if (memberOverwrite) {
            permissions &= ~BigInt(memberOverwrite.deny || 0n);
            permissions |= BigInt(memberOverwrite.allow || 0n);
        }
    }

    return permissions;
}

export function hasPermission(userPerms: bigint, requiredPerm: bigint): boolean {
    if ((userPerms & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
    return (userPerms & requiredPerm) === requiredPerm;
}
