'use strict'

const pino = require('pino')

module.exports = async function foo (app) {
  app.log.info('This is an info')
  app.log.warn('This is a warn')
  app.log.error('This is an error')

  app.get('/', async () => {
    console.log('This is a\n console.log')
    console.error('This is a\n console.error')

    console.log(JSON.stringify({ ts: '123', foo: 'bar' }))
    console.log('#'.repeat(1e4))
    console.log(Buffer.from(Array.from(Array(1e2)).map((_, i) => i)))

    const logger = pino({ level: 'trace' })
    logger.trace('This is a trace')
    logger.fatal({ payload: { ts: '123', foo: 'bar' } }, 'This is a fatal with object')

    return { ok: true }
  })
}
