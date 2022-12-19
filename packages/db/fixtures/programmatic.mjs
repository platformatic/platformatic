import { buildServer } from '../index.js'
import { join } from 'desm'

const server = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  core: {
    connectionString: 'sqlite://::memory::'
  },
  migrations: {
    dir: join(import.meta.url, "./migrations"),
    table: "versions",
    autoApply: true
  }
})

await server.listen() // this will start our server

console.log('URL', server.url)
