import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { Generator } from '../index.js'

test('should export a Generator property', async () => {
  strictEqual(new Generator().module, '@platformatic/lavoratore')
})

test('should generate a JavaScript Worker', async () => {
  const generator = new Generator()
  generator.setConfig({ applicationName: 'worker' })
  await generator.prepare()

  ok(generator.getFileObject('index.js', 'src').contents.includes('async fetch (request, env, ctx)'))

  const wrangler = JSON.parse(generator.getFileObject('wrangler.json').contents)
  strictEqual(wrangler.name, 'worker')
  strictEqual(wrangler.main, 'src/index.js')
  ok(wrangler.compatibility_date)

  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)
  deepStrictEqual(Object.keys(packageJson.dependencies), ['@platformatic/lavoratore'])
})

test('should generate a TypeScript Worker', async () => {
  const generator = new Generator()
  generator.setConfig({ applicationName: 'worker', typescript: true })
  await generator.prepare()

  ok(generator.getFileObject('index.ts', 'src').contents.includes('ExportedHandler<Env>'))
  strictEqual(JSON.parse(generator.getFileObject('wrangler.json').contents).main, 'src/index.ts')
  ok(generator.getFileObject('tsconfig.json'))
})
