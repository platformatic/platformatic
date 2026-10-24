import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'
import { setTimeout as sleep } from 'node:timers/promises'

// This is needed in some tests to allow another process to start tailing logs
if (process.env.PLT_TESTS_DELAY_START) {
  await sleep(parseInt(process.env.PLT_TESTS_DELAY_START))
}

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({}, { level: 'trace' })
})

app.get('/', async () => {
  return {
    production: process.env.NODE_ENV === 'production',
    // PLT_DEV and PLT_ENVIRONMENT are not injected; reported so their absence is asserted.
    plt_dev: process.env.PLT_DEV ?? null,
    plt_environment: process.env.PLT_ENVIRONMENT ?? null
  }
})

app.get('/version', async () => {
  return { version: 123 }
})

app.get('/time', async (_, reply) => {
  reply.header('Cache-Control', 'public, s-maxage=30')
  return { time: Date.now() }
})

app.post('/', async request => {
  return { body: request.body }
})
app.log.trace('This is a trace')

// The log-tailing tests attach `wattpm logs` after the runtime has booted, so a single trace
// emitted once here can be gone before the tail connects. Those tests are exactly the ones that set
// PLT_TESTS_DELAY_START (to attach during the delayed start), so under that flag keep emitting a
// trace on an interval -- whenever the tail connects it then sees one within a poll. Unref'd so it
// never keeps the process alive.
if (process.env.PLT_TESTS_DELAY_START) {
  setInterval(() => app.log.trace('This is a trace'), 200).unref()
}

app.listen({ port: 0 }).then(() => {
  app.log.info('Service listening')
})
