import { buildServer } from '../index.js'
import { join } from 'desm'

const app = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  db: {
    connectionString: 'sqlite://::memory::'
  },
  migrations: {
    dir: join(import.meta.url, './migrations'),
    table: 'versions',
    autoApply: true
  }
})

await app.start() // this will start our server

console.log('URL', app.url)
