import { connect } from '@platformatic/db-core'
import { kMetadata } from '@platformatic/foundation'
import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InvalidSchemaLockError } from './errors.js'

export async function setupDB (log, config) {
  const { db, sql, entities, dbschema } = await connect({ ...config, log })

  return {
    db,
    sql,
    entities,
    dbschema
  }
}

export function urlDirname (url) {
  return dirname(fileURLToPath(url))
}

export function locateSchemaLock (config) {
  return config.db.schemalock.path ?? join(config[kMetadata].root, 'schema.lock')
}

export function isSchemaLockReadOnly (config) {
  const { readOnly } = config.db.schemalock ?? {}
  return readOnly === true || readOnly === 'true'
}

// The information_schema queries used for introspection include *_catalog
// columns, which contain the name of the database the schema was introspected
// against. They are not used to build the entities, so they are stripped to
// keep the lock file deterministic across database names.
export function serializeDbschema (dbschema) {
  return JSON.stringify(dbschema, (key, value) => (/_catalog$/i.test(key) ? undefined : value), 2)
}

export async function updateSchemaLock (logger, config) {
  if (config.db.schemalock && !isSchemaLockReadOnly(config)) {
    const conn = await setupDB(logger, { ...config.db, dbschema: null })
    const schemaLockPath = locateSchemaLock(config)
    await fs.writeFile(schemaLockPath, serializeDbschema(conn.dbschema))

    await conn.db.dispose()
  }
}

export function validateSchemaLockFormat (schemaLock) {
  const isBoolean = typeof schemaLock === 'boolean'
  const isObject = typeof schemaLock === 'object'

  if (!isBoolean && !isObject) {
    throw new InvalidSchemaLockError()
  }
  if (
    isObject &&
    typeof schemaLock.path !== 'string' &&
    typeof schemaLock.readOnly !== 'boolean' &&
    typeof schemaLock.readOnly !== 'string'
  ) {
    throw new InvalidSchemaLockError()
  }
  if (isObject && schemaLock.path !== undefined && typeof schemaLock.path !== 'string') {
    throw new InvalidSchemaLockError()
  }
}
