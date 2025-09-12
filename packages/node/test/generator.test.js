import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { Generator } from '../index.js'
import { version } from '../lib/schema.js'

test('should export a Generator property', async () => {
  const generator = new Generator()
  deepStrictEqual(generator.module, '@platformatic/node')
})

test('should return environment and environment variables', async () => {
  const generator = new Generator()

  generator.targetDirectory = 'foo'
  generator.setConfig({ env: { foo: 'bar' } })

  deepStrictEqual(await generator.prepare(), {
    targetDirectory: 'foo',
    env: { foo: 'bar' }
  })
})

test('should generate proper index.js file (Javascript)', async () => {
  const generator = new Generator()
  await generator.prepare()
  const file = generator.getFileObject('index.js')

  deepStrictEqual(file.contents.split(/\r?\n/), [
    "import { createServer } from 'node:http'",
    '',
    'export function create() {',
    '  return createServer((_, res) => {',
    "    globalThis.platformatic.logger.debug('Serving request.')",
    "    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })",
    "    res.end(JSON.stringify({ hello: 'world' }))",
    '  })',
    '}',
    ''
  ])
})

test('should prepare a valid package.json file (Javascript)', async () => {
  const generator = new Generator()
  await generator.prepare()
  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)

  deepStrictEqual(packageJson.main, 'index.js')
  deepStrictEqual(packageJson.dependencies['@platformatic/node'], `^${version}`)
  deepStrictEqual(packageJson.devDependencies, {})
})

test('should generate proper index.js file (Typescript)', async () => {
  const generator = new Generator()
  generator.setConfig({ typescript: true })
  await generator.prepare()
  const file = generator.getFileObject('index.ts')

  deepStrictEqual(file.contents.split(/\r?\n/), [
    "import { getGlobal } from '@platformatic/globals'",
    "import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'",
    '',
    'export function create() {',
    '  const platformatic = getGlobal()',
    '',
    '  return createServer((_: IncomingMessage, res: ServerResponse) => {',
    "    platformatic.logger.debug('Serving request.')",
    "    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })",
    "    res.end(JSON.stringify({ hello: 'world' }))",
    '  })',
    '}',
    ''
  ])
})

test('should prepare a valid package.json file (Typescript)', async () => {
  const generator = new Generator()
  generator.setConfig({ typescript: true })
  await generator.prepare()
  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)

  deepStrictEqual(packageJson.main, 'index.ts')
  deepStrictEqual(packageJson.dependencies['@platformatic/globals'], `^${version}`)
  deepStrictEqual(packageJson.dependencies['@platformatic/node'], `^${version}`)
  deepStrictEqual(packageJson.devDependencies['@types/node'], '^22.0.0')
})

test('should prepare a valid tsconfig.json file (Typescript)', async () => {
  const generator = new Generator()
  generator.setConfig({ typescript: true })
  await generator.prepare()
  const tsConfig = JSON.parse(generator.getFileObject('tsconfig.json').contents)

  deepStrictEqual(tsConfig, { extends: '@platformatic/tsconfig' })
})

test('should prepare a valid watt.json file', async () => {
  const generator = new Generator()
  await generator.prepare()
  const wattJson = JSON.parse(generator.getFileObject('watt.json').contents)

  deepStrictEqual(wattJson, {
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
  })
})
