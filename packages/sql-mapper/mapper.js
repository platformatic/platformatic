'use strict'

const buildEntity = require('./lib/entity')
const queriesFactory = require('./lib/queries')
const fp = require('fastify-plugin')
const { areSchemasSupported } = require('./lib/utils')

// Ignore the function as it is only used only for MySQL and PostgreSQL
/* istanbul ignore next */
async function buildConnection (log, createConnectionPool, connectionString, poolSize, schema) {
  const db = await createConnectionPool({
    connectionString,
    bigIntMode: 'string',
    poolSize,
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

async function connect ({ connectionString, log, onDatabaseLoad, poolSize = 10, ignore = {}, autoTimestamp = true, hooks = {}, schema, limit = {}, dbschema }) {
  if (typeof autoTimestamp === 'boolean' && autoTimestamp === true) {
    autoTimestamp = defaultAutoTimestampFields
  }
  // TODO validate config using the schema
  if (!connectionString) {
    throw new Error('connectionString is required')
  }

  let queries
  let sql
  let db

  /* istanbul ignore next */
  if (connectionString.indexOf('postgres') === 0) {
    const createConnectionPoolPg = require('@databases/pg')
    db = await buildConnection(log, createConnectionPoolPg, connectionString, poolSize)
    sql = createConnectionPoolPg.sql
    queries = queriesFactory.pg
    db.isPg = true
  } else if (connectionString.indexOf('mysql') === 0) {
    const createConnectionPoolMysql = require('@databases/mysql')
    db = await buildConnection(log, createConnectionPoolMysql, connectionString, poolSize)
    sql = createConnectionPoolMysql.sql
    const version = (await db.query(sql`SELECT VERSION()`))[0]['VERSION()']
    db.version = version
    db.isMariaDB = version.indexOf('maria') !== -1
    if (db.isMariaDB) {
      queries = queriesFactory.mariadb
    } else {
      db.isMySql = true
      queries = queriesFactory.mysql
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
    queries = queriesFactory.sqlite
    db.isSQLite = true
  } else {
    throw new Error('You must specify either postgres, mysql or sqlite as protocols')
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

    for (const { table, schema, columns, constraints } of dbschema) {
      // The following line is a safety net when developing this module,
      // it should never happen.
      /* istanbul ignore next */
      if (typeof table !== 'string') {
        throw new Error(`Table must be a string, got '${table}'`)
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

    return {
      db,
      sql,
      entities,
      addEntityHooks,
      dbschema
    }
  } catch (err) /* istanbul ignore next */ {
    db.dispose()
    throw err
  }

  function addEntityHooks (entityName, hooks) {
    const entity = entities[entityName]
    if (!entity) {
      throw new Error('Cannot find entity ' + entityName)
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

module.exports = fp(sqlMapper)
module.exports.connect = connect
module.exports.plugin = module.exports
module.exports.utils = require('./lib/utils')
