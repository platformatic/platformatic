'use strict'

const fp = require('fastify-plugin')
const { findNearestString } = require('@platformatic/utils')
const buildEntity = require('./lib/entity')
const buildCleanUp = require('./lib/clean-up')
const queriesFactory = require('./lib/queries')
const { areSchemasSupported } = require('./lib/utils')
const errors = require('./lib/errors')
const setupCache = require('./lib/cache')

// Ignore the function as it is only used only for MySQL and PostgreSQL
/* istanbul ignore next */
async function buildConnection (log, createConnectionPool, connectionString, poolSize, schema, idleTimeoutMilliseconds, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds) {
  const db = await createConnectionPool({
    connectionString,
    bigIntMode: 'string',
    poolSize,
    idleTimeoutMilliseconds,
    queueTimeoutMilliseconds,
    acquireLockTimeoutMilliseconds,
    onQueryStart: (_query, { text, values }) => {
      log.trace({
        query: {
          text,
          values
        }
      }, 'start query')
    },
    onQueryResults: (_query, { text }, results) => {
      log.trace({
        query: {
          text,
          results: results.length
        }
      }, 'end query')
    },
    onQueryError: (_query, { text }, err) => {
      log.error({
        query: {
          text,
          error: err.message
        }
      }, 'query error')
    },
    schema
  })
  return db
}

const defaultAutoTimestampFields = {
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

async function createConnectionPool ({ log, connectionString, poolSize, idleTimeoutMilliseconds, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds }) {
  let db
  let sql

  poolSize = poolSize || 10

  /* istanbul ignore next */
  if (connectionString.indexOf('postgres') === 0) {
    const createConnectionPoolPg = require('@databases/pg')
    db = await buildConnection(log, createConnectionPoolPg, connectionString, poolSize, null, idleTimeoutMilliseconds, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds)
    sql = createConnectionPoolPg.sql
    db.isPg = true
  } else if (connectionString.indexOf('mysql') === 0) {
    const createConnectionPoolMysql = require('@databases/mysql')
    db = await buildConnection(log, createConnectionPoolMysql, connectionString, poolSize, null, idleTimeoutMilliseconds, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds)
    sql = createConnectionPoolMysql.sql
    const version = (await db.query(sql`SELECT VERSION()`))[0]['VERSION()']
    db.version = version
    db.isMariaDB = version.indexOf('maria') !== -1
    if (!db.isMariaDB) {
      db.isMySql = true
    }
  } else if (connectionString.indexOf('sqlite') === 0) {
    const sqlite = require('@matteo.collina/sqlite-pool')
    const path = connectionString.replace('sqlite://', '')
    db = sqlite.default(connectionString === 'sqlite://:memory:' ? undefined : path, {}, {
      // TODO make this configurable
      maxSize: 1,
      // TODO make this configurable
      // 10s max time to wait for a connection
      releaseTimeoutMilliseconds: 10000,
      onQuery ({ text, values }) {
        log.trace({
          query: {
            text
          }
        }, 'query')
      }
    })
    sql = sqlite.sql
    db.isSQLite = true
  } else {
    throw new errors.SpecifyProtocolError()
  }

  return { db, sql }
}

async function connect ({ connectionString, log, onDatabaseLoad, poolSize, include = {}, ignore = {}, autoTimestamp = true, hooks = {}, schema, limit = {}, dbschema, cache, idleTimeoutMilliseconds, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds }) {
  if (typeof autoTimestamp === 'boolean' && autoTimestamp === true) {
    autoTimestamp = defaultAutoTimestampFields
  }
  // TODO validate config using the schema
  if (!connectionString) {
    throw new errors.ConnectionStringRequiredError()
  }

  let queries
  const { db, sql } = await createConnectionPool({ log, connectionString, poolSize, queueTimeoutMilliseconds, acquireLockTimeoutMilliseconds, idleTimeoutMilliseconds })

  /* istanbul ignore next */
  if (db.isPg) {
    queries = queriesFactory.pg
  } else if (db.isMySql) {
    queries = queriesFactory.mysql
  } else if (db.isMariaDB) {
    queries = queriesFactory.mariadb
  } else if (db.isSQLite) {
    queries = queriesFactory.sqlite
  }

  // Specify an empty array must be the same of specifying no schema
  /* istanbul ignore next */ // Ignoring because this won't be fully covered by DB not supporting schemas (SQLite)
  const schemaList = areSchemasSupported(db) && schema?.length > 0 ? schema : null
  const useSchema = !!schemaList

  const entities = {}

  try {
    /* istanbul ignore else */
    if (typeof onDatabaseLoad === 'function') {
      await onDatabaseLoad(db, sql)
    }

    if (!dbschema) {
      dbschema = await queries.listTables(db, sql, schemaList)

      // TODO make this parallel or a single query
      for (const wrap of dbschema) {
        const { table, schema } = wrap
        const columns = await queries.listColumns(db, sql, table, schema)
        wrap.constraints = await queries.listConstraints(db, sql, table, schema)
        wrap.columns = columns

        // To get enum values in pg
        /* istanbul ignore next */
        if (db.isPg) {
          const enums = await queries.listEnumValues(db, sql, table, schema)
          for (const enumValue of enums) {
            const column = columns.find(column => column.column_name === enumValue.column_name)
            if (!column.enum) {
              column.enum = [enumValue.enumlabel]
            } else {
              column.enum.push(enumValue.enumlabel)
            }
          }
        }
      }
    }

    const schemaTables = dbschema.map(table => table.table)
    if (Object.keys(include).length) {
      for (const includedTable of Object.keys(include)) {
        if (!schemaTables.includes(includedTable)) {
          const nearestTable = findNearestString(schemaTables, includedTable)
          let warningMessage = `Specified table "${includedTable}" not found.`
          if (nearestTable) {
            warningMessage += ` Did you mean "${nearestTable}"?`
          }
          log.warn(warningMessage)
        }
      }
    }

    for (const ignoredTable of Object.keys(ignore)) {
      if (!schemaTables.includes(ignoredTable)) {
        const nearestTable = findNearestString(schemaTables, ignoredTable)
        let warningMessage = `Ignored table "${ignoredTable}" not found.`
        if (nearestTable) {
          warningMessage += ` Did you mean "${nearestTable}"?`
        }
        log.warn(warningMessage)
      }
    }

    for (const { table, schema, columns, constraints } of dbschema) {
      // The following line is a safety net when developing this module,
      // it should never happen.
      /* istanbul ignore next */
      if (typeof table !== 'string') {
        throw new errors.TableMustBeAStringError(table)
      }
      // If include is being used and a table is not explicitly included add it to the ignore object
      if (Object.keys(include).length && !include[table]) {
        ignore[table] = true
      }
      if (ignore[table] === true) {
        continue
      }
      const entity = buildEntity(db, sql, log, table, queries, autoTimestamp, schema, useSchema, ignore[table] || {}, limit, schemaList, columns, constraints)
      // Check for primary key of all entities
      if (entity.primaryKeys.size === 0) {
        log.warn({ table }, 'Cannot find any primary keys for table')
        continue
      }

      entities[entity.singularName] = entity

      if (hooks[entity.name]) {
        addEntityHooks(entity.singularName, hooks[entity.name])
      } else if (hooks[entity.singularName]) {
        addEntityHooks(entity.singularName, hooks[entity.singularName])
      }
    }

    const res = {
      db,
      sql,
      entities,
      cleanUpAllEntities: buildCleanUp(db, sql, log, entities, queries),
      addEntityHooks,
      dbschema
    }

    if (cache) {
      res.cache = setupCache(res, cache)
    }

    return res
  } catch (err) /* istanbul ignore next */ {
    db.dispose()
    throw err
  }

  function addEntityHooks (entityName, hooks) {
    const entity = entities[entityName]
    if (!entity) {
      throw new errors.CannotFindEntityError(entityName)
    }
    for (const key of Object.keys(hooks)) {
      if (hooks[key] && entity[key]) {
        entity[key] = hooks[key].bind(null, entity[key])
      }
    }
  }
}

async function sqlMapper (app, opts) {
  const mapper = await connect({
    log: app.log,
    ...opts
  })

  app.onClose(() => mapper.db.dispose())
  // TODO this would need to be refactored as other plugins
  // would need to use this same namespace
  if (app.hasDecorator('platformatic')) {
    Object.assign(app.platformatic, mapper)
  } else {
    app.decorate('platformatic', mapper)
  }

  app.decorateRequest('platformaticContext', null)
  app.addHook('onRequest', function (req, reply, done) {
    req.platformaticContext = {
      app: this, // uses the encapsulated fastify instance of the route
      reply
    }
    done()
  })
}

async function dropTable (db, sql, table) {
  try {
    if (db.isSQLite) {
      await db.query(sql`DROP TABLE ${sql(table)};`)
    } else {
      await db.query(sql`DROP TABLE ${sql(table)} CASCADE;`)
    }
    return table
  } catch (err) {
    // ignore, it will be dropped on the next roundon the next roundon the next roundon the next round
  }
}

async function dropAllTables (db, sql, schemas) {
  let queries
  /* istanbul ignore next */
  if (db.isPg) {
    queries = queriesFactory.pg
  } else if (db.isMySql) {
    queries = queriesFactory.mysql
  } else if (db.isMariaDB) {
    queries = queriesFactory.mariadb
  } else if (db.isSQLite) {
    queries = queriesFactory.sqlite
  }

  const tables = new Set((await queries.listTables(db, sql, schemas)).map((t) => {
    /* istanbul ignore next */
    if (t.schema) {
      return `${t.schema}.${t.table}`
    }
    return t.table
  }))
  let count = 0

  while (tables.size > 0) {
    if (count++ > 100) {
      throw new Error('too many iterations, unable to clear the db')
    }

    const deletes = []
    for (const table of tables) {
      deletes.push(dropTable(db, sql, table))
    }

    const res = await Promise.all(deletes)
    for (const table of res) {
      if (table) {
        tables.delete(table)
      }
    }
  }
}

module.exports = fp(sqlMapper)
module.exports.connect = connect
module.exports.createConnectionPool = createConnectionPool
module.exports.plugin = module.exports
module.exports.utils = require('./lib/utils')
module.exports.errors = errors
module.exports.dropAllTables = dropAllTables
