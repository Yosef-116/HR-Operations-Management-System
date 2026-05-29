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
  auth: 'Security & Access',
  shared: 'Cross-Module'
};

const cleanIdentifier = (value) => value.replace(/"/g, '').trim();

const parseColumnType = (definition) => {
  const match = definition.match(/^(.+?)(?:\s+NOT NULL|\s+DEFAULT\b|\s+UNIQUE\b|\s+GENERATED\b|\s+CONSTRAINT\b|\s+PRIMARY\b|\s+REFERENCES\b|$)/i);
  return match ? match[1].trim() : definition.trim();
};

const parseResources = (sql) => {
  const resources = {};
  const createTablePattern = /CREATE TABLE\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi;
  let match;

  while ((match = createTablePattern.exec(sql)) !== null) {
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
      appendOnly: schema === 'auth' && table === 'audit_logs'
    };

    resources[resource.key] = resource;
  }

  const foreignKeyPattern = /ALTER TABLE\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+ADD CONSTRAINT\s+[a-z_][a-z0-9_]*\s+FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+\(([^)]+)\)/gi;
  while ((match = foreignKeyPattern.exec(sql)) !== null) {
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

const readResources = () => {
  if (!fs.existsSync(schemaSqlPath)) {
    throw new Error(`Schema SQL file not found at ${schemaSqlPath}`);
  }
  return parseResources(fs.readFileSync(schemaSqlPath, 'utf8'));
};

const resources = readResources();
const resourceList = Object.values(resources);

const getResource = (schema, table) => {
  const resource = resources[`${schema}.${table}`];
  if (!resource) return null;
  return resource;
};

module.exports = {
  schemaSqlPath,
  resources,
  resourceList,
  getResource,
  parseResources
};
