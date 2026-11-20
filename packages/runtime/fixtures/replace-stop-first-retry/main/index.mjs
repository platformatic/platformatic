import fastify from 'fastify'
import { existsSync } from 'node:fs'

export function create () {
  const app = fastify({ logger: { level: 'info' } })

  // The start fails for as long as the marker file exists, so that a test
  // decides which start attempts fail.
  app.addHook('onReady', async () => {
    const marker = process.env.PLT_TESTS_FAIL_START_MARKER

    if (marker && existsSync(marker)) {
      throw new Error('The application failed to start on purpose')
    }
  })

  app.get('/', async () => {
    return { from: 'main' }
  })

  return app
}
