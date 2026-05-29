const db = require('../config/db');
const { resourceList } = require('../config/resources');
const ResourceModel = require('../models/ResourceModel');
const auditService = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getRecordId, isTruthy } = require('../utils/queryUtils');

const pkValuesFromRequest = (req, resource) => {
  if (resource.primaryKey.length === 1 && req.params.id !== undefined) {
    return { [resource.primaryKey[0]]: req.params.id };
  }

  const where = req.body && req.body.where && typeof req.body.where === 'object' ? req.body.where : {};
  const source = { ...req.query, ...where };
  return Object.fromEntries(resource.primaryKey.map((key) => [key, source[key]]));
};

const listResources = asyncHandler(async (req, res) => {
  const grouped = resourceList.reduce((acc, resource) => {
    acc[resource.schema] = acc[resource.schema] || {
      schema: resource.schema,
      module: resource.module,
      tables: []
    };
    acc[resource.schema].tables.push(resource);
    return acc;
  }, {});

  res.json({
    success: true,
    data: Object.values(grouped),
    meta: {
      tableCount: resourceList.length
    }
  });
});

const list = asyncHandler(async (req, res) => {
  const result = await ResourceModel.findAll(req.resource, req.query);
  res.json({
    success: true,
    data: result.rows,
    meta: result.meta
  });
});

const getOne = asyncHandler(async (req, res) => {
  const row = await ResourceModel.findByPk(req.resource, pkValuesFromRequest(req, req.resource));
  if (!row) throw new AppError(`${req.resource.key} record not found`, 404);

  res.json({
    success: true,
    data: row
  });
});

const create = asyncHandler(async (req, res) => {
  const resource = req.resource;

  const created = await db.withTransaction(async (client) => {
    const row = await ResourceModel.create(resource, req.body, client);
    await auditService.writeAuditLog({
      client,
      userId: req.user && req.user.user_id,
      actionType: 'INSERT',
      tableName: resource.key,
      recordId: getRecordId(resource, row),
      newValue: row,
      ipAddress: req.ip
    });
    return row;
  });

  res.status(201).json({
    success: true,
    data: created
  });
});

const update = asyncHandler(async (req, res) => {
  const resource = req.resource;
  const pkValues = pkValuesFromRequest(req, resource);

  const updated = await db.withTransaction(async (client) => {
    const oldRow = await ResourceModel.findByPk(resource, pkValues, client, { includeDeleted: true });
    if (!oldRow) throw new AppError(`${resource.key} record not found`, 404);

    const newRow = await ResourceModel.updateByPk(resource, pkValues, req.body, client);
    await auditService.writeAuditLog({
      client,
      userId: req.user && req.user.user_id,
      actionType: 'UPDATE',
      tableName: resource.key,
      recordId: getRecordId(resource, newRow),
      oldValue: oldRow,
      newValue: newRow,
      ipAddress: req.ip
    });
    return newRow;
  });

  res.json({
    success: true,
    data: updated
  });
});

const remove = asyncHandler(async (req, res) => {
  const resource = req.resource;
  const pkValues = pkValuesFromRequest(req, resource);
  const hard = isTruthy(req.query.hard);

  const deleted = await db.withTransaction(async (client) => {
    const oldRow = await ResourceModel.findByPk(resource, pkValues, client, { includeDeleted: true });
    if (!oldRow) throw new AppError(`${resource.key} record not found`, 404);

    const row = await ResourceModel.deleteByPk(resource, pkValues, client, { hard });
    await auditService.writeAuditLog({
      client,
      userId: req.user && req.user.user_id,
      actionType: 'DELETE',
      tableName: resource.key,
      recordId: getRecordId(resource, row || oldRow),
      oldValue: oldRow,
      newValue: row,
      ipAddress: req.ip
    });
    return row;
  });

  res.json({
    success: true,
    data: deleted
  });
});

module.exports = {
  listResources,
  list,
  getOne,
  create,
  update,
  remove
};
