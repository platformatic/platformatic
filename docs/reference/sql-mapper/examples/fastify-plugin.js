// Referenced in docs/reference/sql-mapper/fastify-plugin.md
'use strict'

const Fastify = require('fastify')
const mapper = require('@platformatic/sql-mapper')

async function main() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  })
  app.register(mapper.plugin, {
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  })
  
  app.get('/all-pages', async (req, reply) => {
    const res = await app.platformatic.entities.page.find()
    return res
  })
  
  await app.listen({ port: 3333 })
}

main()