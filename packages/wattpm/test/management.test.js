import { version } from '@platformatic/runtime'
import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { waitForStart, wattpm } from './helper.js'

test('ps - should show running applications', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  const { url } = await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const psProcess = await wattpm('ps')
  const lines = psProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['PID', 'Name', 'Version', 'Uptime', 'URL', 'Directory'])

  const main = lines.find(l => l[1] === 'main' && l[4] === url)
  deepStrictEqual(main[0], startProcess.pid.toString())
  deepStrictEqual(main[2], version)
  ok(main[3].match(/now|(\d+s)/))
})

test('ps - should warn when no runtimes are available', async t => {
  const logsProcess = await wattpm('ps')

  deepStrictEqual(logsProcess.exitCode, 0)
  ok(logsProcess.stdout.includes('No runtimes found.'))
})

test('applications - should list applications for an application with no workers information in development mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('dev', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const applicationsProcess = await wattpm('applications', 'main')
  const lines = applicationsProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['Name', 'Type', 'Entrypoint'])
  deepStrictEqual(lines[4], ['alternative', 'nodejs', 'No'])
  deepStrictEqual(lines[5], ['main', 'nodejs', 'Yes'])
})

test('applications - should list applications for an application with workers information in production mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', true, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const applicationsProcess = await wattpm('applications', 'main')
  const lines = applicationsProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['Name', 'Workers', 'Type', 'Entrypoint'])
  deepStrictEqual(lines[4], ['alternative', '1', 'nodejs', 'No'])
  deepStrictEqual(lines[5], ['main', '1', 'nodejs', 'Yes'])
})

test('applications - should complain when a runtime is not found', async t => {
  const applicationsProcess = await wattpm('applications', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(applicationsProcess.exitCode, 1)
  ok(applicationsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should list environment variable for a server', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main')
  ok(envProcess.stdout.includes('RUNTIME_ENV=foo'))
})

test('env - should list environment variable for an application in tabular way', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', '-t', 'main')
  ok(envProcess.stdout.match(/\|\s+RUNTIME_ENV\s+\|\s+foo/))
})

test('env - should list environment variable for an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'main')
  ok(envProcess.stdout.includes('APPLICATION_ENV=bar'))
})

test('env - should complain when a runtime is not found', async t => {
  const envProcess = await wattpm('env', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should complain when an application is not found', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'invalid', { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching application.'))
})

test('config - should list configuration for an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const alternativeApplicationDir = resolve(rootDir, 'web/alternative')
  const mainApplicationDir = resolve(rootDir, 'web/main')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

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
      captureStdio: true,
      level: 'trace'
    },
    entrypoint: 'main',
    autoload: {
      path: `${resolve(rootDir, 'web')}`,
      exclude: []
    },
    sourceMaps: false,
    reuseTcpPorts: true,
    restartOnError: 2,
    exitOnUnhandledErrors: true,
    startTimeout: 30000,
    messagingTimeout: 30000,
    managementApi: true,
    preload: [resolve('../wattpm-pprof-capture/index.js')],
    applications: [
      {
        id: 'alternative',
        type: '@platformatic/node',
        path: alternativeApplicationDir,
        config: resolve(alternativeApplicationDir, 'watt.json'),
        entrypoint: false,
        watch: false,
        workers: {
          static: 1
        },
        dependencies: [],
        localUrl: 'http://alternative.plt.local'
      },
      {
        id: 'main',
        type: '@platformatic/node',
        path: mainApplicationDir,
        config: resolve(mainApplicationDir, 'watt.json'),
        entrypoint: true,
        watch: false,
        workers: {
          static: 1
        },
        dependencies: [],
        localUrl: 'http://main.plt.local'
      }
    ],
    applicationTimeout: 300000,
    workers: {
      static: 1
    },
    workersRestartDelay: 0,
    watch: false,
    gracefulShutdown: {
      runtime: 10000,
      application: 10000
    },
    health: {
      enabled: true,
      gracePeriod: 30000,
      interval: 30000,
      maxELU: 0.99,
      maxHeapTotal: 4294967296,
      maxHeapUsed: 0.99,
      maxUnhealthyChecks: 10,
      maxYoungGeneration: 134217728
    },
    resolvedApplicationsBasePath: 'external',
    metrics: {
      enabled: true,
      timeout: 1000
    }
  })
})

test('config - should list configuration for an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const configProcess = await wattpm('config', 'main', 'main')

  deepStrictEqual(JSON.parse(configProcess.stdout), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json',
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
      main: 'index.js',
      dispatchViaHttp: false,
      disablePlatformaticInBuild: false,
      hasServer: true
    },
    watch: {
      enabled: false
    },
    telemetry: {}
  })
})

test('config - should complain when a runtime is not found', async t => {
  const configProcess = await wattpm('config', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(configProcess.exitCode, 1)
  ok(configProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('config - should complain when an application is not found', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const configProcess = await wattpm('config', 'main', 'invalid', { reject: false })

  deepStrictEqual(configProcess.exitCode, 1)
  ok(configProcess.stdout.includes('Cannot find a matching application.'))
})
