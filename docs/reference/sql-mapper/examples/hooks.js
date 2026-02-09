// Referenced in docs/reference/sql-mapper/hooks.md
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const pgConnectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: pgConnectionString,
    log: logger,
  })
  mapper.addEntityHooks('page', {
    find: async function firstHook(previousFunction, opts) {
      // Add a `foo` field with `bar` value to each row
      const res = await previousFunction(opts)
      return res.map((row) => {
        row.foo = 'bar'
        return row
      })
    }
  })
  mapper.addEntityHooks('page', {
    find: async function secondHook(previousFunction, opts) {
      // Add a `bar` field with `baz` value to each row
      const res = await previousFunction(opts)
      return res.map((row) => {
        row.bar = 'baz'
        return row
      })
    }
  })
  const res = await mapper.entities.page.find({ 
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 10
      }
    },
  })
  logger.info(res)
  await mapper.db.dispose()
}

main()
