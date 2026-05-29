const fs = require('fs');
const path = require('path');

const schemaSqlPath = path.resolve(process.cwd(), 'Mysql', 'hr_postgresql_schema.sql');

const schemaLabels = {
  org: 'Organisation',
  recruitment: 'Recruitment',
  payroll: 'Finance & Compensation',
  people: 'Promotion',
  performance: 'Performance',
  training: 'Training',
  hr_auth: 'Security & Access',
  shared: 'Cross-Module'
};

const cleanIdentifier = (value) => value.replace(/"/g, '').trim();

const parseColumnType = (definition) => {
  const match = definition.match(/^(.+?)(?:\s+NOT NULL|\s+DEFAULT\b|\s+UNIQUE\b|\s+GENERATED\b|\s+CONSTRAINT\b|\s+PRIMARY\b|\s+REFERENCES\b|$)/i);
  return match ? match[1].trim() : definition.trim();
};

const parseResources = (sql) => {
  const resources = {};
  // Use \r?\n to handle both Unix (LF) and Windows (CRLF) line endings.
  // The original \n-only pattern silently matched nothing on CRLF files,
  // leaving resourceList empty and every GET /data/* route returning 404.
  const normalizedSql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const createTablePattern = /CREATE TABLE\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi;
  let match;

  while ((match = createTablePattern.exec(normalizedSql)) !== null) {
    const [, schema, table, body] = match;
    const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
    const columns = [];
    let primaryKey = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/,$/, '').trim();
      const primaryKeyMatch = line.match(/^CONSTRAINT\s+[a-z_][a-z0-9_]*\s+PRIMARY KEY\s+\(([^)]+)\)/i);

      if (primaryKeyMatch) {
        primaryKey = primaryKeyMatch[1].split(',').map(cleanIdentifier);
        continue;
      }

      if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i.test(line)) continue;

      const columnMatch = line.match(/^([a-z_][a-z0-9_]*)\s+(.+)$/i);
      if (!columnMatch) continue;

      const [, name, definition] = columnMatch;
      const type = parseColumnType(definition);
      columns.push({
        name,
        type,
        nullable: !/\bNOT NULL\b/i.test(definition),
        unique: /\bUNIQUE\b/i.test(definition),
        hasDefault: /\bDEFAULT\b/i.test(definition),
        isSerial: /\bSERIAL\b/i.test(type),
        isGenerated: /\bGENERATED\s+ALWAYS\b/i.test(definition)
      });
    }

    const resource = {
      key: `${schema}.${table}`,
      schema,
      table,
      module: schemaLabels[schema] || schema,
      primaryKey,
      columns,
      foreignKeys: {},
      softDelete: columns.some((column) => column.name === 'is_deleted') && columns.some((column) => column.name === 'deleted_at'),
      appendOnly: schema === 'hr_auth' && table === 'audit_logs'
    };

    resources[resource.key] = resource;
  }

  const foreignKeyPattern = /ALTER TABLE\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+ADD CONSTRAINT\s+[a-z_][a-z0-9_]*\s+FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+\(([^)]+)\)/gi;
  while ((match = foreignKeyPattern.exec(normalizedSql)) !== null) {
    const [, schema, table, column, targetSchema, targetTable, targetColumn] = match;
    const key = `${schema}.${table}`;
    if (resources[key]) {
      resources[key].foreignKeys[cleanIdentifier(column)] = {
        schema: targetSchema,
        table: targetTable,
        column: cleanIdentifier(targetColumn)
      };
    }
  }

  return resources;
};

// FIX: The original code called readResources() at the top level, so a missing
// SQL file threw an unhandled error at require() time — crashing the process
// with a confusing stack trace before the server even started.
//
// The fix uses lazy initialisation: resources are loaded on the first call to
// getResource() or accessing resourceList/resources. If the file is missing,
// the error is thrown with a clear message that names the missing path and
// suggests running migrations.
let _resources = null;

const loadResources = () => {
  if (_resources) return _resources;

  if (!fs.existsSync(schemaSqlPath)) {
    throw new Error(
      `Schema SQL file not found at:\n  ${schemaSqlPath}\n\n` +
      'Run "npm run migrate" to generate the schema file, then restart the server.'
    );
  }

  _resources = parseResources(fs.readFileSync(schemaSqlPath, 'utf8'));
  return _resources;
};

const getResource = (schema, table) => {
  const all = loadResources();
  return all[`${schema}.${table}`] || null;
};

// Lazy proxy — iterating resourceList triggers the load on first use
const resourceListProxy = new Proxy([], {
  get(_, prop) {
    return Object.values(loadResources())[prop];
  }
});

// For callers that destructure { resources, resourceList }
Object.defineProperty(module.exports, 'resources', {
  get: () => loadResources(),
  enumerable: true
});

Object.defineProperty(module.exports, 'resourceList', {
  get: () => Object.values(loadResources()),
  enumerable: true
});

module.exports.schemaSqlPath = schemaSqlPath;
module.exports.getResource = getResource;
module.exports.parseResources = parseResources;
