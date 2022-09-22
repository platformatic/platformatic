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
  logger.info(mapper.entities.page)
  await mapper.db.dispose()
}

main()
