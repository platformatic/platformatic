import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration, readAndStripSchemaStamp } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

test('the stamp is read for version detection and stripped', () => {
  const config = { $schema: 'https://schemas.platformatic.dev/wattpm/4.0.0.json', applications: [] }

  strictEqual(readAndStripSchemaStamp(config, 'watt.config.js'), 'https://schemas.platformatic.dev/wattpm/4.0.0.json')

  // Stripped, because the v4 schema does not admit it: a stamp that reached AJV would mean the
  // loader had skipped the step that checks the file is not a v3 one.
  deepStrictEqual(config, { applications: [] })
})

test('a URL the loader does not recognize is not its to interpret', () => {
  const config = { $schema: './my-own-schema.json', applications: [] }

  strictEqual(readAndStripSchemaStamp(config, 'watt.config.js'), './my-own-schema.json')
  deepStrictEqual(config, { applications: [] })
})

test('a stale v3 stamp refuses with the migrate hint', async t => {
  const root = await createTree(t, {
    'watt.config.js':
      'export default { $schema: "https://schemas.platformatic.dev/wattpm/3.65.0.json", applications: [] }',
    'package.json': '{ "name": "stamped", "type": "module" }'
  })

  /*
    It is the one signal that a file was generated against a schema whose meaning has since changed,
    and a machine-written file nobody reads is exactly where a silent reinterpretation goes
    unnoticed.
  */
  await rejects(
    () =>
      loadConfiguration({
        cwd: root,
        configPath: join(root, 'watt.config.js'),
        command: 'start',
        production: true,
        realEnv: {},
        validateCapabilities: false
      }),
    error => {
      strictEqual(error.code, 'PLT_LEGACY_SCHEMA_STAMP')
      return true
    }
  )
})

test('a stamped v4 configuration loads', async t => {
  const root = await createTree(t, {
    'watt.config.js':
      'export default { $schema: "https://schemas.platformatic.dev/wattpm/4.0.0.json", applications: [] }',
    'package.json': '{ "name": "stamped", "type": "module" }'
  })

  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.js'),
    command: 'start',
    production: true,
    realEnv: {},
    validateCapabilities: false
  })

  strictEqual(loaded.config.$schema, undefined)
  deepStrictEqual(loaded.config.applications, [])
})
