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

test('should generate proper index.js file', async () => {
  const generator = new Generator()
  await generator.prepare()
  const file = generator.getFileObject('index.js')

  deepStrictEqual(file.contents.split(/\r?\n/), [
    "import { createServer } from 'node:http'",
    '',
    'export function create() {',
    '  return createServer((req, res) => {',
    "    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })",
    "    res.end(JSON.stringify({ hello: 'world' }))",
    '  })',
    '}',
    ''
  ])
})

test('should include @platformatic/node inside package.json dependencies', async () => {
  const generator = new Generator()
  await generator.prepare()
  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)

  deepStrictEqual(packageJson.dependencies['@platformatic/node'], `^${version}`)
})

test('should prepare a main entrypoint start script', async () => {
  const generator = new Generator()
  await generator.prepare()
  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)

  deepStrictEqual(packageJson.main, 'index.js')
  deepStrictEqual(packageJson.scripts.start, 'node index.js')
})

test('should prepare a valid watt.json file', async () => {
  const generator = new Generator()
  await generator.prepare()
  const wattJson = JSON.parse(generator.getFileObject('watt.json').contents)

  deepStrictEqual(wattJson, {
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
  })
})
