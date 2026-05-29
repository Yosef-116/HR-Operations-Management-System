const AppError = require('./AppError');

const identifierPattern = /^[a-z_][a-z0-9_]*$/i;

const quoteIdent = (identifier) => {
  if (!identifierPattern.test(identifier)) {
    throw new AppError(`Invalid SQL identifier: ${identifier}`, 400);
  }
  return `"${identifier}"`;
};

const qualifiedName = (resource) => `${quoteIdent(resource.schema)}.${quoteIdent(resource.table)}`;

const columnNames = (resource) => new Set(resource.columns.map((column) => column.name));

const selectList = (resource) => resource.columns.map((column) => quoteIdent(column.name)).join(', ');

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const getLimitOffset = (query) => {
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 500);
  const page = Math.max(Number(query.page || 1), 1);
  const offset = query.offset !== undefined ? Math.max(Number(query.offset), 0) : (page - 1) * limit;
  return { limit, offset, page };
};

const writableColumns = (resource, mode) => resource.columns.filter((column) => {
  if (column.isGenerated) return false;
  if (column.name === 'created_at' || column.name === 'deleted_at') return false;
  if (column.name === 'updated_at') return false;
  if (column.name === 'is_deleted') return false;
  if (mode === 'create') {
    return !(resource.primaryKey.includes(column.name) && column.isSerial);
  }
  return !resource.primaryKey.includes(column.name);
});

const pickWritable = (resource, payload, mode) => {
  const allowed = new Set(writableColumns(resource, mode).map((column) => column.name));
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key, value]) => allowed.has(key) && value !== undefined)
  );
};

const getRecordId = (resource, row) => {
  if (!row) return 0;
  const firstKey = resource.primaryKey[0];
  const value = firstKey ? Number(row[firstKey]) : 0;
  return Number.isFinite(value) ? value : 0;
};

const textSearchColumns = (resource) => resource.columns
  .filter((column) => /(CHAR|TEXT|VARCHAR)/i.test(column.type))
  .map((column) => column.name);

module.exports = {
  quoteIdent,
  qualifiedName,
  columnNames,
  selectList,
  isTruthy,
  getLimitOffset,
  pickWritable,
  writableColumns,
  getRecordId,
  textSearchColumns
};
