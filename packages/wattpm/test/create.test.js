import { isWindows } from '@platformatic/basic/test/helper.js'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { version } from '../lib/schema.js'
import { createTemporaryDirectory, wattpm } from './helper.js'

async function setupInquirer (root, expected) {
  let newInquirerPath = resolve(root, 'inquirer.js')

  const template = await readFile(new URL('./fixtures/inquirer-template.js', import.meta.url), 'utf8')

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

  const inquirerPath = await setupInquirer(temporaryFolder, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath } })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf8')), {
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

  const inquirerPath = await setupInquirer(temporaryFolder, [
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

  await wattpm('create', '-s', {
    cwd: temporaryFolder,
    env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf8')), {
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

  const inquirerPath = await setupInquirer(temporaryFolder, [
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

  const inquirerPath = await setupInquirer(temporaryFolder, [
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

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt-alternative.json'), 'utf8')), {
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

  const inquirerPath1 = await setupInquirer(temporaryFolder, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath1 } })

  deepStrictEqual(JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf8')), {
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

  const inquirerPath2 = await setupInquirer(temporaryFolder, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'root' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'alternate' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' }
  ])

  await wattpm('create', '-s', { cwd: temporaryFolder, env: { NO_COLOR: true, INQUIRER_PATH: inquirerPath2 } })

  deepStrictEqual(
    JSON.parse(await readFile(resolve(temporaryFolder, 'root/watt.json'), 'utf8')).entrypoint,
    'alternate'
  )
})

test('create - should create a new project using a different package manager', async t => {
  const temporaryFolder = await createTemporaryDirectory(t, 'create')

  const inquirerPath = await setupInquirer(temporaryFolder, [
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

  const inquirerPath = await setupInquirer(temporaryFolder, [
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
