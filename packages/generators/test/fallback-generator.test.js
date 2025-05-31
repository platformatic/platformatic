const { deepStrictEqual } = require('node:assert')
const { test } = require('node:test')
const { FallbackGenerator } = require('../index.js')

test('should generate proper files for @platformatic packages', async () => {
  const generator = new FallbackGenerator({ serviceName: 'name', module: '@platformatic/utils', version: '1.2.3' })

  await generator.prepare()

  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)
  deepStrictEqual(packageJson, { name: 'name', dependencies: { '@platformatic/utils': '^1.2.3' } })

  const wattJson = JSON.parse(generator.getFileObject('watt.json').contents)
  deepStrictEqual(wattJson, { $schema: 'https://schemas.platformatic.dev/@platformatic/utils/1.2.3.json' })
})

test('should generate proper files for generic packages', async () => {
  const generator = new FallbackGenerator({ serviceName: 'name', module: 'fastify', version: '1.2.3' })

  await generator.prepare()

  const packageJson = JSON.parse(generator.getFileObject('package.json').contents)
  deepStrictEqual(packageJson, { name: 'name', dependencies: { fastify: '^1.2.3' } })

  const wattJson = JSON.parse(generator.getFileObject('watt.json').contents)
  deepStrictEqual(wattJson, { module: 'fastify' })
})
