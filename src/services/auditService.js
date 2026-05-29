const db = require('../config/db');

const toRecordId = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

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
  if (tableName === 'auth.audit_logs') return;

  const executor = client || db;
  try {
    await executor.query(
      `INSERT INTO auth.audit_logs (user_id, action_type, table_name, record_id, old_value, new_value, ip_address)
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
    console.error('Audit logging failed:', error.message);
  }
};

module.exports = {
  writeAuditLog
};
