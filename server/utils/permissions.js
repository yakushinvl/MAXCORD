const Permissions = {
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

// Helper for strings
const PermissionNames = Object.keys(Permissions);

// Default permissions for @everyone (standard users)
const DEFAULT_PERMISSIONS =
    Permissions.VIEW_CHANNEL |
    Permissions.SEND_MESSAGES |
    Permissions.READ_MESSAGE_HISTORY |
    Permissions.CONNECT |
    Permissions.SPEAK |
    Permissions.STREAM |
    Permissions.CHANGE_NICKNAME |
    Permissions.CREATE_INSTANT_INVITE |
    Permissions.ADD_REACTIONS;

module.exports = {
    Permissions,
    PermissionNames,
    DEFAULT_PERMISSIONS,
    // Helper to convert bigint to string if needed for storage (though Mongo handles it if used as Number or String)
    // But BigInt is safer for 64 flags.
    serialize: (perm) => perm.toString(),
    deserialize: (str) => BigInt(str)
};
