const db = require('../config/db');

const toRecordId = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// FIX: The original catch block silently swallowed all audit failures with a
// plain console.error. This made it impossible to distinguish audit failures
// from other log noise, and compliance-relevant events could disappear without
// any alert. The fix emits a clearly tagged structured log so the failure is
// visible in log aggregators, and includes enough context (actionType,
// tableName, recordId) to reconstruct what was lost.
const writeAuditLog = async ({
  client,
  userId,
  actionType,
  tableName,
  recordId,
  oldValue = null,
  newValue = null,
  ipAddress = null
}) => {
  if (tableName === 'hr_auth.audit_logs') return;

  const executor = client || db;
  try {
    await executor.query(
      `INSERT INTO hr_auth.audit_logs (user_id, action_type, table_name, record_id, old_value, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        userId || null,
        actionType,
        tableName,
        toRecordId(recordId),
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress
      ]
    );
  } catch (error) {
    // Tag audit failures distinctly so they surface in log searches and alerts.
    // Never silently drop them — a missing audit trail is a compliance issue.
    console.error('[AUDIT_FAILURE]', {
      actionType,
      tableName,
      recordId: toRecordId(recordId),
      userId: userId || null,
      error: error.message
    });
  }
};

module.exports = {
  writeAuditLog
};
