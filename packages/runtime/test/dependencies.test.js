import { deepStrictEqual, ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('parses gateway and client dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dependencies.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { applications } = await runtime.getApplications()

  const mainApplication = applications.find(application => application.id === 'main')

  deepStrictEqual(mainApplication.dependencies, [
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    {
      id: 'external-service-1',
      url: 'http://external-dependency-1',
      local: false
    }
  ])

  const application1 = applications.find(application => application.id === 'service-1')
  deepStrictEqual(application1.dependencies, [])

  const application2 = applications.find(application => application.id === 'service-2')
  deepStrictEqual(application2.dependencies, [])
})

test('correct throws on missing dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await rejects(() => runtime.init(), {
    name: 'FastifyError',
    message: "Missing dependency: \"application 'composer' has unknown dependency: 'missing'.\""
  })
})

test('correct throws on missing dependencies, showing all applications', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies2.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await rejects(() => runtime.init(), {
    name: 'FastifyError',
    message:
      "Missing dependency: \"application 'main' has unknown dependency: 'service-1'. Did you mean 'service-2'? Known applications are: service-2.\""
  })
})

test('correct warns on reversed dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-reversed-dependencies.json')
  const context = {}
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  const logs = await readLogs(context.logsPath, 5000, true)

  ok(
    logs.includes(
      'Application \\"main\\" depends on application \\"service-1\\", but it is defined and it will be started before it. Please check your configuration file.'
    )
  )
})
