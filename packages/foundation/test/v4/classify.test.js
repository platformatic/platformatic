import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import {
  autoWrapApplicationDefinition,
  classifyConfiguration
} from '../../lib/v4/index.js'

const file = '/proj/watt.config.ts'

test('an object with module is an application definition, unconditionally', () => {
  strictEqual(classifyConfiguration({ module: '@platformatic/next' }, file), 'application')

  // No key-collision check: capabilities legitimately use option names that are also root keys, so
  // any collision list would misclassify valid factory results.
  strictEqual(classifyConfiguration({ module: '@platformatic/gateway', applications: [] }, file), 'application')
  strictEqual(classifyConfiguration({ module: '@platformatic/nitro', entrypoint: './index.js' }, file), 'application')
  strictEqual(classifyConfiguration({ module: '@platformatic/node', application: { basePath: '/' } }, file), 'application')
})

test('an object with application, applications or autoload is a root config', () => {
  strictEqual(classifyConfiguration({ applications: [] }, file), 'root')
  strictEqual(classifyConfiguration({ application: { path: '.' } }, file), 'root')
  strictEqual(classifyConfiguration({ autoload: { path: 'web' } }, file), 'root')
})

test('an empty object classifies as a root config, which is not the same as valid', () => {
  // An empty config file is a statement, not an absence: it does not fall through to zero-config
  // detection, which is for a project that has no configuration at all.
  strictEqual(classifyConfiguration({}, file), 'root')
  strictEqual(classifyConfiguration({ logger: { level: 'info' } }, file), 'root')
})

test('everything that is not an object is refused ahead of the rules, naming the type', () => {
  // null is the one worth spelling out: typeof null === 'object', so it would otherwise reach
  // rule 2 as a property read on nothing.
  for (const [value, described] of [
    [null, 'null'],
    [[{ module: '@platformatic/node' }], 'array'],
    ['watt', 'string'],
    [42, 'number'],
    [true, 'boolean'],
    [new Date(0), 'Date instance']
  ]) {
    throws(() => classifyConfiguration(value, file), error => {
      strictEqual(error.code, 'PLT_INVALID_CONFIGURATION_EXPORT')
      ok(error.message.includes(file))
      ok(error.message.includes(described), `${error.message} should name ${described}`)
      return true
    })
  }
})

test('auto-wrapping produces the normalized singular form', () => {
  const definition = { module: '@platformatic/next' }

  deepStrictEqual(autoWrapApplicationDefinition(definition), { application: { config: definition } })
})
