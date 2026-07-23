import { getEvents } from '@platformatic/globals'
import fastify from 'fastify'
import { writeFileSync } from 'node:fs'

const exitEventFile = process.env.PLT_EXIT_EVENT_FILE

if (exitEventFile) {
  getEvents().once('exit', () => {
    writeFileSync(exitEventFile, 'exit')
  })
}

const app = fastify()

app.get('/', async () => ({ ok: true }))

app.listen({ port: 0 })
