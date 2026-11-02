import { ok, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'

const root = join(import.meta.dirname, '..', 'fixtures', 'event-loop-delay')

for (const scenario of [
  { name: 'defaults', global: {}, application: {}, elu: 50, heap: 50 },
  { name: 'global levels', global: { maxELULogLevel: 'warn', maxHeapUsedLogLevel: 'info' }, application: {}, elu: 40, heap: 30 },
  {
    name: 'application overrides',
    global: { maxELULogLevel: 'warn', maxHeapUsedLogLevel: 'info' },
    application: { maxELULogLevel: 'debug', maxHeapUsedLogLevel: 'trace' },
    elu: 20,
    heap: 10
  },
  { name: 'silent ELU', global: { maxELULogLevel: 'silent' }, application: {}, heap: 50 },
  { name: 'silent heap', global: { maxHeapUsedLogLevel: 'silent' }, application: {}, elu: 50 },
  { name: 'fatal levels', global: { maxELULogLevel: 'fatal', maxHeapUsedLogLevel: 'fatal' }, application: {}, elu: 60, heap: 60 }
]) {
  test(`health threshold logging: ${scenario.name}`, { timeout: 30000 }, async t => {
    const context = {}
    const app = await createRuntime(root, {
      $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.75.1.json',
      entrypoint: 'main',
      applications: [{ id: 'main', path: './services/main', config: 'platformatic.service.json', health: scenario.application }],
      server: { hostname: '127.0.0.1', port: 0 },
      logger: { level: 'trace' },
      restartOnError: 100,
      health: {
        gracePeriod: 1,
        interval: 1000,
        maxUnhealthyChecks: 2,
        // Both thresholds are exceeded even by an idle worker.
        maxELU: 0,
        maxHeapUsed: 0,
        ...scenario.global
      }
    }, context)
    t.after(() => app.close())

    const unhealthy = once(app, 'application:worker:unhealthy')
    await app.start()
    const [event] = await unhealthy
    strictEqual(event.application, 'main')

    const messages = await readLogs(context.logsPath)
    for (const [fragment, level] of [['has an ELU of', scenario.elu], ['of the memory', scenario.heap]]) {
      const matching = messages.filter(message => message.msg.includes(fragment))
      if (level === undefined) {
        strictEqual(matching.length, 0)
      } else {
        ok(matching.length > 0)
        ok(matching.every(message => message.level === level))
      }
    }

    ok(messages.some(message => message.msg.includes('is unhealthy. Replacing it') && message.level === 50))
  })
}

for (const option of ['maxELULogLevel', 'maxHeapUsedLogLevel']) {
  test(`rejects invalid ${option}`, async () => {
    await rejects(createRuntime(root, {
      $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.75.1.json',
      entrypoint: 'main',
      applications: [{ id: 'main', path: './services/main', config: 'platformatic.service.json' }],
      health: { [option]: 'invalid' }
    }), { code: 'PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA' })
  })
}
