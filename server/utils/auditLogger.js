const AuditLog = require('../models/AuditLog');

const logAction = async ({ 
  serverId, 
  executorId, 
  targetId, 
  targetModel, 
  action, 
  changes = [], 
  reason = null 
}) => {
  try {
    const log = new AuditLog({
      server: serverId,
      executor: executorId,
      target: targetId,
      targetModel,
      action,
      changes,
      reason
    });
    await log.save();
    console.log(`[Audit] ${action} logged for server ${serverId}`);
  } catch (err) {
    console.error('[Audit] Failed to log action:', err);
  }
};

module.exports = { logAction };
