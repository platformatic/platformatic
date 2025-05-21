import { isWindows } from '@platformatic/basic/test/helper.js'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { version } from '../lib/schema.js'
import { createTemporaryDirectory, wattpm } from './helper.js'

async function setupInquirer (t, expected) {
  const temporaryFolder = await createTemporaryDirectory(t, 'inquirer')
  let newInquirerPath = resolve(temporaryFolder, 'inquirer.js')

  const template = await readFile(new URL('./fixtures/inquirer-template.js', import.meta.url), 'utf-8')

  await writeFile(
    newInquirerPath,
    template.replace('const expected = []', `const expected = ${JSON.stringify(expected)}\n`),
    'utf-8'
  )

  if (isWindows) {
    newInquirerPath = pathToFileURL(newInquirerPath).toString()
  }

  return newInquirerPath
}

test('create - should create a new project using watt.json by default', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath } })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf-8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
    autoload: {
      exclude: ['docs'],
      path: 'web'
    },
    logger: {
      level: '{PLT_SERVER_LOGGER_LEVEL}'
    },
    managementApi: '{PLT_MANAGEMENT_API}',
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}'
    },
    watch: true
  })
})

test('create - should create a new project with two services', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'yes' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath } })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf-8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
    autoload: {
      exclude: ['docs'],
      path: 'web'
    },
    logger: {
      level: '{PLT_SERVER_LOGGER_LEVEL}'
    },
    managementApi: '{PLT_MANAGEMENT_API}',
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}'
    },
    watch: true,
    entrypoint: 'alternate'
  })
})

test('create - should not install @platformatic/runtime as it is already available', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const createProcess = await wattpm('create', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath }
  })

  ok(!createProcess.stdout.includes('Installing @platformatic/runtime'))
})

test('create - should use a custom configuration file', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-c', 'watt-alternative.json', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt-alternative.json'), 'utf-8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
    autoload: {
      exclude: ['docs'],
      path: 'web'
    },
    logger: {
      level: '{PLT_SERVER_LOGGER_LEVEL}'
    },
    managementApi: '{PLT_MANAGEMENT_API}',
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}'
    },
    watch: true
  })
})

test('create - should correctly set the chosen user entrypoint', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath1 = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath1 } })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf-8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
    autoload: {
      exclude: ['docs'],
      path: 'web'
    },
    logger: {
      level: '{PLT_SERVER_LOGGER_LEVEL}'
    },
    managementApi: '{PLT_MANAGEMENT_API}',
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}'
    },
    watch: true
  })

  const inquirerPath2 = await setupInquirer(t, [
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath2 } })

  deepStrictEqual(
    JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf-8')).entrypoint,
    'alternate'
  )
})

test('create - should create a new project using a different package manager', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const createProcess = await wattpm('create', '-P', 'pnpm', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath }
  })

  ok(createProcess.stdout.includes('Installing dependencies for the application using pnpm'))
  ok(createProcess.stdout.includes('Installing dependencies for the service main using pnpm'))
  ok(createProcess.stdout.includes('You are all set! Run `pnpm start` to start your project.'))
})

test('create - should support providing stackable via command line', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const createProcess = await wattpm('create', '-M', 'first', '-M', 'second,third', '-M', '  fourth ,fifth  ', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath }
  })

  ok(
    createProcess.stdout.includes(
      `
? Which kind of service do you want to create? @platformatic/service
  first
  second
  third
  fourth
  fifth
> @platformatic/service
  @platformatic/composer
  @platformatic/db
`
    )
  )
})

test('create - should wrap existing Node.js applications into Watt', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  await writeFile(resolve(temporaryFolder, 'index.js'), 'console.log("Hello world")', 'utf-8')

  const inquirerPath = await setupInquirer(t, [
    {
      type: 'list',
      question: 'This folder seems to already contain a Node.js application. Do you want to wrap into Watt?',
      reply: 'yes'
    },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath } })

  deepStrictEqual(
    await readFile(resolve(temporaryFolder, '.env'), 'utf-8'),
    `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3042
PLT_SERVER_LOGGER_LEVEL=info
PLT_MANAGEMENT_API=true
`.trim()
  )

  deepStrictEqual(
    await readFile(resolve(temporaryFolder, '.env.sample'), 'utf-8'),
    `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3042
PLT_SERVER_LOGGER_LEVEL=info
PLT_MANAGEMENT_API=true
`.trim()
  )

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'package.json')), 'utf-8'), {
    dependencies: {
      '@platformatic/node': `^${version}`,
      platformatic: `^${version}`,
      wattpm: `^${version}`
    },
    devDependencies: {},
    engines: {
      node: '^18.8.0 || >=20.6.0'
    },
    name: basename(temporaryFolder),
    scripts: {
      dev: 'wattpm dev',
      start: 'wattpm start',
      build: 'wattpm build'
    }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'watt.json')), 'utf-8'), {
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`,
    runtime: {
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      },
      managementApi: '{PLT_MANAGEMENT_API}',
      server: {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}'
      }
    }
  })
})

test('create - should not attempt to wrap twice', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  await writeFile(resolve(temporaryFolder, 'index.js'), 'console.log("Hello world")', 'utf-8')

  const firstInquirerPath = await setupInquirer(t, [
    {
      type: 'list',
      question: 'This folder seems to already contain a Node.js application. Do you want to wrap into Watt?',
      reply: 'yes'
    },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' }
  ])

  const secondInquirerPath = await setupInquirer(t, [])

  await wattpm('create', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: firstInquirerPath }
  })

  const createProcess = await wattpm('create', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: secondInquirerPath }
  })

  ok(
    !createProcess.stdout.includes(
      'This folder seems to already contain a Node.js application. Do you want to wrap into Watt?'
    )
  )
  ok(createProcess.stdout.includes('The Node.js application has already been wrapped into Watt.'))
})

test('create - should wrap existing frontend applications into Watt', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  await writeFile(resolve(temporaryFolder, '.env'), ['A=B', 'C=D'].join('\n'), 'utf-8')
  await writeFile(resolve(temporaryFolder, '.env.sample'), ['E=F', 'G=H'].join('\n'), 'utf-8')

  await writeFile(
    resolve(temporaryFolder, 'package.json'),
    JSON.stringify({
      engines: {
        next: '^15'
      },
      whatever: 'else',
      name: 'test-app',
      scripts: {
        start: 'wattpm start',
        dev: 'next dev',
        build: 'next build'
      },
      dependencies: {
        next: '^13.4.0',
        another: '^1'
      },
      devDependencies: {
        bar: '^2'
      }
    }),
    'utf-8'
  )

  const inquirerPath = await setupInquirer(t, [
    {
      type: 'list',
      question: 'This folder seems to already contain a Next.js application. Do you want to wrap into Watt?',
      reply: 'yes'
    },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath } })

  deepStrictEqual(
    await readFile(resolve(temporaryFolder, '.env'), 'utf-8'),
    `
A=B
C=D
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3042
PLT_SERVER_LOGGER_LEVEL=info
PLT_MANAGEMENT_API=true
`.trim()
  )

  deepStrictEqual(
    await readFile(resolve(temporaryFolder, '.env.sample'), 'utf-8'),
    `
E=F
G=H
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3042
PLT_SERVER_LOGGER_LEVEL=info
PLT_MANAGEMENT_API=true
`.trim()
  )

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'package.json')), 'utf-8'), {
    name: 'test-app',
    scripts: {
      start: 'wattpm start',
      dev: 'next dev',
      build: 'next build'
    },
    dependencies: {
      '@platformatic/next': `^${version}`,
      another: '^1',
      next: '^13.4.0',
      platformatic: `^${version}`,
      wattpm: `^${version}`
    },
    devDependencies: {
      bar: '^2'
    },
    whatever: 'else',
    engines: {
      next: '^15',
      node: '^18.8.0 || >=20.6.0'
    }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'watt.json')), 'utf-8'), {
    $schema: `https://schemas.platformatic.dev/@platformatic/next/${version}.json`,
    runtime: {
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      },
      managementApi: '{PLT_MANAGEMENT_API}',
      server: {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}'
      }
    }
  })
})
