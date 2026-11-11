#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MODULES_DIR = __dirname;
const SCHEMA_PATH = path.join(MODULES_DIR, '_manifest.schema.json');

function validateAgainstSchema(data, schema, pathPrefix = '') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type) {
    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`${pathPrefix || 'root'}: expected array`);
        return errors;
      }
      if (schema.items) {
        data.forEach((item, idx) => {
          errors.push(...validateAgainstSchema(item, schema.items, `${pathPrefix}[${idx}]`));
        });
      }
      return errors;
    }
    if (schema.type === 'object') {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${pathPrefix || 'root'}: expected object`);
        return errors;
      }
      if (Array.isArray(schema.required)) {
        for (const reqKey of schema.required) {
          if (data[reqKey] === undefined || data[reqKey] === null) {
            errors.push(`${pathPrefix ? pathPrefix + '.' : ''}${reqKey}: required field missing`);
          }
        }
      }
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (data[key] !== undefined && data[key] !== null) {
            errors.push(...validateAgainstSchema(data[key], propSchema, pathPrefix ? `${pathPrefix}.${key}` : key));
          }
        }
      }
      return errors;
    }
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        errors.push(`${pathPrefix}: expected string`);
        return errors;
      }
      if (schema.pattern && !(new RegExp(schema.pattern).test(data))) {
        errors.push(`${pathPrefix}: string "${data}" does not match pattern ${schema.pattern}`);
      }
    } else if (schema.type === 'integer') {
      if (!Number.isInteger(data)) {
        errors.push(`${pathPrefix}: expected integer`);
      }
    } else if (schema.type === 'number') {
      if (typeof data !== 'number' || Number.isNaN(data)) {
        errors.push(`${pathPrefix}: expected number`);
      }
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    errors.push(`${pathPrefix}: value "${data}" not in enum [${schema.enum.join(', ')}]`);
  }

  return errors;
}

function buildSchemaValidator(schema) {
  try {
    const Ajv = require('ajv');
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    return (data) => {
      const ok = validate(data);
      if (ok) return [];
      return (validate.errors || []).map((e) => `${e.instancePath || 'root'} ${e.message}`);
    };
  } catch (_) {
    return (data) => validateAgainstSchema(data, schema);
  }
}

function dependencyExists(depName, baseDirs) {
  for (const dir of baseDirs) {
    const asDir = path.join(dir, depName);
    const asFile = path.join(dir, depName + '.js');
    const asIndex = path.join(dir, depName, 'index.js');
    if (fs.existsSync(asIndex) || fs.existsSync(asFile) || fs.existsSync(asDir)) {
      return true;
    }
  }
  return false;
}

function hasExportedFunction(modDir, fnName) {
  const indexFile = path.join(modDir, 'index.js');
  if (!fs.existsSync(indexFile)) return false;
  const src = fs.readFileSync(indexFile, 'utf8');
  const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(\\b${escaped}\\s*\\(|\\b${escaped}\\s*:|\\bmodule\\.exports\\.${escaped}\\s*=)`, 'm');
  if (re.test(src)) return true;
  const prevZacc = process.env.ZACC_ENABLED;
  process.env.ZACC_ENABLED = '0';
  try {
    const mod = require(indexFile);
    if (mod && typeof mod.stop === 'function' && mod.version && mod.scanner) {
      try { mod.stop(); } catch (_) {}
    }
    if (mod && typeof mod[fnName] === 'function') return true;
  } catch (_) {
    // ignore
  } finally {
    if (prevZacc === undefined) delete process.env.ZACC_ENABLED;
    else process.env.ZACC_ENABLED = prevZacc;
  }
  return false;
}

function validateAllManifests(scanDirs) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const schemaValidate = buildSchemaValidator(schema);
  const dirs = scanDirs || [
    MODULES_DIR,
    path.resolve(MODULES_DIR, '../../modules'),
    path.resolve(MODULES_DIR, '../backend/modules'),
  ].filter((d, idx, arr) => fs.existsSync(d) && arr.indexOf(d) === idx);

  const seen = new Set();
  const results = [];

  for (const rootDir of dirs) {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modDir = path.join(rootDir, entry.name);
      const manifestPath = path.join(modDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);

      const reasons = [];
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        results.push({ module: entry.name, valid: false, reasons: ['invalid JSON: ' + err.message] });
        continue;
      }

      const schemaErrors = schemaValidate(manifest);
      if (schemaErrors.length > 0) {
        reasons.push(...schemaErrors);
      }

      if (manifest.healthCheck && !hasExportedFunction(modDir, manifest.healthCheck)) {
        reasons.push(`healthCheck "${manifest.healthCheck}" is not exported by ${entry.name}/index.js`);
      }

      if (Array.isArray(manifest.dependencies)) {
        for (const dep of manifest.dependencies) {
          if (!dependencyExists(dep, dirs)) {
            reasons.push(`dependency "${dep}" does not exist as a module`);
          }
        }
      }

      results.push({
        module: manifest.name || entry.name,
        version: manifest.version,
        capabilitiesCount: Array.isArray(manifest.capabilities) ? manifest.capabilities.length : 0,
        dependenciesCount: Array.isArray(manifest.dependencies) ? manifest.dependencies.length : 0,
        valid: reasons.length === 0,
        reasons,
      });
    }
  }

  return results;
}

if (require.main === module) {
  const results = validateAllManifests();
  let invalidCount = 0;
  for (const r of results) {
    if (r.valid) {
      console.log(`VALID   | ${r.module}@${r.version} (${r.capabilitiesCount} capabilities, ${r.dependenciesCount} deps)`);
    } else {
      invalidCount += 1;
      console.error(`INVALID | ${r.module}: ${r.reasons.join('; ')}`);
    }
  }
  console.log(`\nTotal: ${results.length} manifests, ${results.length - invalidCount} valid, ${invalidCount} invalid.`);
  process.exit(invalidCount > 0 ? 1 : 0);
}

module.exports = { validateAllManifests, validateAgainstSchema };
