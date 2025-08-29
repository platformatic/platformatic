import auth from '@platformatic/db-authorization'
import core from '@platformatic/db-core'
import { isKeyEnabled } from '@platformatic/foundation'
import { platformaticService } from '@platformatic/service'
import { readFile, writeFile } from 'node:fs/promises'
import { execute as applyMigrations } from './migrator.js'
import { root } from './root.js'
import { execute as generateTypes } from './types.js'
import { locateSchemaLock, updateSchemaLock } from './utils.js'

async function healthCheck (app) {
  const { db, sql } = app.platformatic
  try {
    await db.query(sql`SELECT 1`)
    return true
  } catch (err) {
    app.log.warn({ err }, 'Healthcheck failed')
    return false
  }
}

export async function platformaticDatabase (app, capability) {
  const config = await capability.getConfig(true)

  let createSchemaLock = false
  await loadSchemaLock()

  async function loadSchemaLock () {
    if (config.db.schemalock) {
      // ignore errors, this is an optimization
      try {
        const path = locateSchemaLock(config)
        const dbschema = JSON.parse(await readFile(path, 'utf8'))
        config.db.dbschema = dbschema
        app.log.trace({ dbschema }, 'loaded schema lock')
        createSchemaLock = false
      } catch (err) {
        app.log.trace({ err }, 'failed to load schema lock')
        app.log.info('no schema lock found, will create one')
        createSchemaLock = true
      }
    }
  }

  if (config.migrations && config.migrations.autoApply === true && !app.restarted) {
    app.log.debug({ migrations: config.migrations }, 'running migrations')

    const migrationsApplied = await applyMigrations(app.log, config)
    if (migrationsApplied) {
      // reload schema lock
      await updateSchemaLock(app.log, config)
      await loadSchemaLock()
    }

    if (config.types && config.types.autogenerate === true) {
      app.log.debug({ types: config.types }, 'generating types')
      await generateTypes({ logger: app.log, config })
    }
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    const serverConfig = config.server

    if (typeof serverConfig.healthCheck !== 'object') {
      serverConfig.healthCheck = {}
    }

    serverConfig.healthCheck.fn = healthCheck
    await capability.updateContext({ serverConfig })
  }

  if (createSchemaLock) {
    try {
      const path = locateSchemaLock(config)
      await writeFile(path, JSON.stringify(app.platformatic.dbschema, null, 2))
      app.log.info({ path }, 'created schema lock')
    } catch (err) {
      app.log.trace({ err }, 'unable to save schema lock')
    }
  }

  await app.register(core, config.db)

  if (config.authorization) {
    await app.register(auth, config.authorization)
  }

  await platformaticService(app, capability)

  if (Object.keys(app.platformatic.entities).length === 0) {
    app.log.warn(
      'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? ' +
        'This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db'
    )
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    await app.register(root, config)
  }
}

platformaticDatabase[Symbol.for('skip-override')] = true
