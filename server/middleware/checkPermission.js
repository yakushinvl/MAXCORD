const Server = require('../models/Server');
const { computePermissions, hasPermission } = require('../utils/permissionCalculator');
const { Permissions } = require('../utils/permissions');

/**
 * Middleware to check a specific server permission
 * @param {BigInt} permission The permission required
 * @param {string} serverIdParam The name of the req.params field containing the server ID
 */
const checkPermission = (permission, serverIdParam = 'id') => {
    return async (req, res, next) => {
        try {
            let serverId;
            if (serverIdParam.startsWith('body.')) {
                serverId = req.body[serverIdParam.split('.')[1]];
            } else if (serverIdParam.startsWith('req.')) {
                serverId = req[serverIdParam.split('.')[1]];
            } else {
                serverId = req.serverId || req.params[serverIdParam];
            }

            if (!serverId) return res.status(404).json({ message: 'Server ID not provided' });

            const server = await Server.findById(serverId);
            if (!server) return res.status(404).json({ message: 'Server not found' });

            // Owner always has permission
            if (String(server.owner) === String(req.user._id)) {
                return next();
            }

            const userPerms = computePermissions(req.user._id, server);
            if (hasPermission(userPerms, permission)) {
                return next();
            }

            res.status(403).json({ message: 'Insufficient permissions' });
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Server error during permission check' });
        }
    };
};

module.exports = checkPermission;
