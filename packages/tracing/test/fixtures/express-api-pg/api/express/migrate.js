const pg = require('pg')
const { join } = require('path')

async function migrate (connectionString) {
  const Postgrator = (await import('postgrator')).default
  const client = new pg.Client({ connectionString })
  try {
    await client.connect()
    const postgrator = new Postgrator({
      migrationPattern: join(__dirname, 'migrations/*'),
      driver: 'pg',
      database: 'test-api',
      execQuery: (query) => client.query(query)
    })
    await postgrator.migrate()
  } catch (error) {
    console.error(error)
  }
  await client.end()
}

module.exports = migrate
