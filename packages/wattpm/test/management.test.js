import { version } from '@platformatic/runtime'
import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { ensureDependency, fixturesDir, waitForStart, wattpm } from './helper.js'

test('ps - should show running applications', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  const url = await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const psProcess = await wattpm('ps')
  const lines = psProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t)
  )

  deepStrictEqual(lines[2], ['PID', 'Name', 'Version', 'Uptime', 'URL', 'Directory'])
  deepStrictEqual(lines[4][0], startProcess.pid.toString())
  deepStrictEqual(lines[4][1], 'main')
  deepStrictEqual(lines[4][2], version)
  ok(lines[4][3].match(/now|(\d+s)/))
  deepStrictEqual(lines[4][4], url)
})

test('ps - should warn when no runtimes are available', async t => {
  const logsProcess = await wattpm('ps')

  deepStrictEqual(logsProcess.exitCode, 0)
  ok(logsProcess.stdout.includes('No runtimes found.'))
})

test('services - should list services for an application', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const servicesProcess = await wattpm('services', 'main')
  const lines = servicesProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t)
  )

  deepStrictEqual(lines[2], ['Name', 'Type', 'Entrypoint'])
  deepStrictEqual(lines[4], ['main', 'nodejs', 'Yes'])
})

test('services - should complain when a runtime is not found', async t => {
  const servicesProcess = await wattpm('services', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(servicesProcess.exitCode, 1)
  ok(servicesProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should list environment variable for an application', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main')
  ok(envProcess.stdout.includes('RUNTIME_ENV=foo'))
})

test('env - should list environment variable for an application in tabular way', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', '-t', 'main')
  ok(envProcess.stdout.match(/\|\s+RUNTIME_ENV\s+\|\s+foo/))
})

test('env - should list environment variable for an service', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'main')
  ok(envProcess.stdout.includes('SERVICE_ENV=bar'))
})

test('env - should complain when a runtime is not found', async t => {
  const envProcess = await wattpm('env', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should complain when a service is not found', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'invalid', { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching service.'))
})

test('config - should list configuration for an application', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const configProcess = await wattpm('config', 'main')

  deepStrictEqual(JSON.parse(configProcess.stdout), {
    $schema: 'https://schemas.platformatic.dev/wattpm/2.0.0.json',
    server: {
      hostname: '127.0.0.1'
    },
    logger: {
      level: 'info'
    },
    entrypoint: 'main',
    autoload: {
      path: `${resolve(rootDir, 'web')}`,
      exclude: []
    },
    restartOnError: 5000,
    managementApi: true,
    serviceMap: {},
    services: [
      {
        id: 'main',
        path: serviceDir,
        config: resolve(serviceDir, 'watt.json'),
        useHttp: false,
        entrypoint: true,
        watch: false,
        dependencies: [],
        localServiceEnvVars: {},
        localUrl: 'http://main.plt.local'
      }
    ],
    watch: false
  })
})

test('config - should list configuration for an service', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const configProcess = await wattpm('config', 'main', 'main')

  deepStrictEqual(JSON.parse(configProcess.stdout), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.0.0-alpha.20.json',
    logger: {
      level: 'info'
    },
    application: {
      outputDirectory: 'dist',
      include: ['dist'],
      commands: {
        install: 'npm ci --omit-dev'
      }
    },
    node: {
      absoluteUrl: false,
      main: 'index.js'
    }
  })
})

test('config - should complain when a runtime is not found', async t => {
  const configProcess = await wattpm('config', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(configProcess.exitCode, 1)
  ok(configProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('config - should complain when a service is not found', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const configProcess = await wattpm('config', 'main', 'invalid', { reject: false })

  deepStrictEqual(configProcess.exitCode, 1)
  ok(configProcess.stdout.includes('Cannot find a matching service.'))
})
