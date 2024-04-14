// Referenced in docs/reference/sql-mapper/entity/relations.md
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
  const pageEntity = mapper.entities.page
  const categoryEntity = mapper.entities.category
  
  const newCategory = await categoryEntity.insert({
    fields: ['id', 'name'],
    inputs: [{ name: 'fiction' }]
  })
  {
    const res = await pageEntity.insert({
      fields: ['id', 'name'],
      inputs: [
        {
          title: 'A fiction', bodyContent: 'This is our first fiction', category_id: newCategory[0].id
        }
      ]
    })
    console.log(res)
  }
  console.log(pageEntity.relations)
  await mapper.db.dispose()
}

main()
