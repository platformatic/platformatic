import { equal, ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { setupApp } from './helper.js'

const handler = async () => ({ ok: true })

async function callTimes (app, times) {
  const origin = await app.listen({ port: 0 })
  for (let i = 0; i < times; i++) {
    await request(`${origin}/test`)
  }
  return app.openTelemetry.exporters[0]
}

test('sampler type always_off records nothing', async () => {
  const app = await setupApp(
    {
      applicationName: 'test-application',
      exporter: { type: 'memory' },
      sampler: { type: 'always_off' }
    },
    handler,
    test.after
  )

  const exporter = await callTimes(app, 3)
  equal(exporter.getFinishedSpans().length, 0)
})

test('sampler type traceidratio honours its ratio option', async () => {
  const none = await setupApp(
    {
      applicationName: 'test-application',
      exporter: { type: 'memory' },
      sampler: { type: 'traceidratio', options: { ratio: 0 } }
    },
    handler,
    test.after
  )
  equal((await callTimes(none, 3)).getFinishedSpans().length, 0)

  const all = await setupApp(
    {
      applicationName: 'test-application',
      exporter: { type: 'memory' },
      sampler: { type: 'traceidratio', options: { ratio: 1 } }
    },
    handler,
    test.after
  )
  equal((await callTimes(all, 3)).getFinishedSpans().length, 3)
})

test('a sampler can be a module, which receives the configured options', async () => {
  const app = await setupApp(
    {
      applicationName: 'test-application',
      exporter: { type: 'memory' },
      sampler: {
        package: resolve(import.meta.dirname, './fixtures/samplers/one-in-every.js'),
        options: { every: 2 }
      }
    },
    handler,
    test.after
  )

  const exporter = await callTimes(app, 4)
  equal(exporter.getFinishedSpans().length, 2)
})

test('an unknown sampler type fails loudly rather than tracing everything', async () => {
  await rejects(
    () =>
      setupApp(
        {
          applicationName: 'test-application',
          exporter: { type: 'memory' },
          sampler: { type: 'probably_not_a_sampler' }
        },
        handler,
        test.after
      ),
    (error) => {
      ok(/probably_not_a_sampler/.test(error.message), error.message)
      return true
    }
  )
})
