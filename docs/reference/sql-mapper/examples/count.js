// Referenced in docs/reference/sql-mapper/entity/api.md
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
  const res = await mapper.entities.page.count({
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
