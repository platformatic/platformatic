import { connect } from '@platformatic/db-core'
import { kMetadata } from '@platformatic/utils'
import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

export async function updateSchemaLock (logger, config) {
  if (config.db.schemalock) {
    const conn = await setupDB(logger, { ...config.db, dbschema: null })
    const schemaLockPath = locateSchemaLock(config)
    await fs.writeFile(schemaLockPath, JSON.stringify(conn.dbschema, null, 2))

    await conn.db.dispose()
  }
}
