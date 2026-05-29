const db = require('../config/db');
const AppError = require('../utils/AppError');
const {
  quoteIdent,
  qualifiedName,
  columnNames,
  selectList,
  isTruthy,
  getLimitOffset,
  pickWritable,
  textSearchColumns
} = require('../utils/queryUtils');

const runner = (client) => client || db;

const buildWhere = (resource, query = {}, options = {}) => {
  const values = [];
  const clauses = [];
  const columns = columnNames(resource);
  const reserved = new Set(['limit', 'offset', 'page', 'sort', 'order', 'search', 'includeDeleted', 'hard']);

  if (resource.softDelete && !isTruthy(query.includeDeleted) && !options.includeDeleted) {
    clauses.push(`${quoteIdent('is_deleted')} = false`);
  }

  for (const [key, value] of Object.entries(query)) {
    if (reserved.has(key) || !columns.has(key) || value === undefined || value === '') continue;
    values.push(value);
    clauses.push(`${quoteIdent(key)} = $${values.length}`);
  }

  if (query.search) {
    const searchable = textSearchColumns(resource);
    if (searchable.length) {
      values.push(`%${query.search}%`);
      const param = `$${values.length}`;
      clauses.push(`(${searchable.map((column) => `${quoteIdent(column)} ILIKE ${param}`).join(' OR ')})`);
    }
  }

  return {
    values,
    whereClause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  };
};

const buildPkWhere = (resource, pkValues, values = []) => {
  if (!resource.primaryKey.length) {
    throw new AppError(`Resource ${resource.key} has no primary key metadata`, 400);
  }

  const clauses = resource.primaryKey.map((key) => {
    if (pkValues[key] === undefined || pkValues[key] === null || pkValues[key] === '') {
      throw new AppError(`Missing primary key value: ${key}`, 400);
    }
    values.push(pkValues[key]);
    return `${quoteIdent(key)} = $${values.length}`;
  });

  return {
    values,
    whereClause: clauses.join(' AND ')
  };
};

// FIX: Use a single query with COUNT(*) OVER() (window function) instead of two
// separate queries. The old approach ran COUNT first, then fetched rows — any
// INSERT or DELETE between those two queries made meta.total inconsistent with
// the rows actually returned. A window function computes both in one atomic pass.
const findAll = async (resource, query = {}, client = null) => {
  const { limit, offset, page } = getLimitOffset(query);
  const { values, whereClause } = buildWhere(resource, query);
  const columns = columnNames(resource);
  const sortColumn = columns.has(query.sort) ? query.sort : (resource.primaryKey[0] || resource.columns[0].name);
  const order = String(query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const pagedValues = values.slice();
  pagedValues.push(limit, offset);

  const result = await runner(client).query(
    `SELECT ${selectList(resource)}, COUNT(*) OVER()::int AS _total
     FROM ${qualifiedName(resource)} ${whereClause}
     ORDER BY ${quoteIdent(sortColumn)} ${order}
     LIMIT $${pagedValues.length - 1} OFFSET $${pagedValues.length}`,
    pagedValues
  );

  // Extract the window-function total and strip the internal _total column
  // from every row before returning to the caller.
  const total = result.rows[0] ? result.rows[0]._total : 0;
  const rows = result.rows.map(({ _total, ...rest }) => rest);

  return {
    rows,
    meta: {
      total,
      limit,
      offset,
      page
    }
  };
};

const findByPk = async (resource, pkValues, client = null, options = {}) => {
  const values = [];
  const pkWhere = buildPkWhere(resource, pkValues, values);
  const clauses = [pkWhere.whereClause];

  if (resource.softDelete && !options.includeDeleted) {
    clauses.push(`${quoteIdent('is_deleted')} = false`);
  }

  const result = await runner(client).query(
    `SELECT ${selectList(resource)} FROM ${qualifiedName(resource)} WHERE ${clauses.join(' AND ')} LIMIT 1`,
    values
  );

  return result.rows[0] || null;
};

const create = async (resource, payload, client = null) => {
  if (resource.appendOnly && resource.key === 'auth.audit_logs') {
    throw new AppError('Audit logs are written by the audit service only', 403);
  }

  const data = pickWritable(resource, payload, 'create');
  const fields = Object.keys(data);
  if (!fields.length) {
    throw new AppError(`No writable fields supplied for ${resource.key}`, 400);
  }

  const values = fields.map((field) => data[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`);

  const result = await runner(client).query(
    `INSERT INTO ${qualifiedName(resource)} (${fields.map(quoteIdent).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${selectList(resource)}`,
    values
  );

  return result.rows[0];
};

const updateByPk = async (resource, pkValues, payload, client = null) => {
  if (resource.appendOnly) {
    throw new AppError(`${resource.key} is append-only`, 403);
  }

  const data = pickWritable(resource, payload, 'update');
  const fields = Object.keys(data);
  const hasUpdatedAt = resource.columns.some((column) => column.name === 'updated_at');

  if (!fields.length && !hasUpdatedAt) {
    throw new AppError(`No writable fields supplied for ${resource.key}`, 400);
  }

  const values = fields.map((field) => data[field]);
  const assignments = fields.map((field, index) => `${quoteIdent(field)} = $${index + 1}`);
  if (hasUpdatedAt) assignments.push(`${quoteIdent('updated_at')} = now()`);

  const pkWhere = buildPkWhere(resource, pkValues, values);

  const result = await runner(client).query(
    `UPDATE ${qualifiedName(resource)} SET ${assignments.join(', ')} WHERE ${pkWhere.whereClause} RETURNING ${selectList(resource)}`,
    pkWhere.values
  );

  return result.rows[0] || null;
};

const deleteByPk = async (resource, pkValues, client = null, options = {}) => {
  if (resource.appendOnly) {
    throw new AppError(`${resource.key} is append-only`, 403);
  }

  const values = [];
  const pkWhere = buildPkWhere(resource, pkValues, values);

  if (resource.softDelete && !options.hard) {
    const result = await runner(client).query(
      `UPDATE ${qualifiedName(resource)} SET ${quoteIdent('is_deleted')} = true, ${quoteIdent('deleted_at')} = now() WHERE ${pkWhere.whereClause} RETURNING ${selectList(resource)}`,
      pkWhere.values
    );
    return result.rows[0] || null;
  }

  const result = await runner(client).query(
    `DELETE FROM ${qualifiedName(resource)} WHERE ${pkWhere.whereClause} RETURNING ${selectList(resource)}`,
    pkWhere.values
  );

  return result.rows[0] || null;
};

module.exports = {
  findAll,
  findByPk,
  create,
  updateByPk,
  deleteByPk,
  buildPkWhere
};
