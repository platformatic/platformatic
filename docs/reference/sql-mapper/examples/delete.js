// Referenced in docs/reference/sql-mapper/entity/api.md
'use strict'

const { connect } = require('@platformatic/sql-mapper')

const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: connectionString,
    log: logger,
  })
  const res = await mapper.entities.page.delete({ 
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 4
      }
    },
  })
  
  logger.info(res)

  await mapper.db.dispose()
}

main()
