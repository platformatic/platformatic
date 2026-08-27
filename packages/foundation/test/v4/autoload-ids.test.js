import { rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

function load (root) {
  return loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.js'),
    command: 'start',
    production: true,
    realEnv: {},
    validateCapabilities: false
  })
}

test('two autoloaded directories resolving to one id are refused, naming both', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "root", "type": "module" }',
    'watt.config.js': 'export default { autoload: { path: "./web" } }',
    // Copied from one another, so they carry the same package name. v3's ids were directory names
    // and could not collide; v4 prefers the package name, which can.
    'web/first/package.json': '{ "name": "frontend", "type": "module" }',
    'web/first/watt.config.js': 'export default { module: "@platformatic/node" }',
    'web/second/package.json': '{ "name": "frontend", "type": "module" }',
    'web/second/watt.config.js': 'export default { module: "@platformatic/node" }'
  })

  await rejects(
    () => load(root),
    error => {
      strictEqual(error.code, 'PLT_DUPLICATE_AUTOLOADED_APPLICATION_ID')
      // Naming both is the point: the message has to say which two directories collided.
      strictEqual(error.message.includes('first'), true, error.message)
      strictEqual(error.message.includes('second'), true, error.message)
      strictEqual(error.message.includes('frontend'), true, error.message)
      return true
    }
  )
})

test('an explicit id through mappings resolves the collision', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "root", "type": "module" }',
    'watt.config.js':
      'export default { autoload: { path: "./web", mappings: { second: { id: "other" } } } }',
    'web/first/package.json': '{ "name": "frontend", "type": "module" }',
    'web/first/watt.config.js': 'export default { module: "@platformatic/node" }',
    'web/second/package.json': '{ "name": "frontend", "type": "module" }',
    'web/second/watt.config.js': 'export default { module: "@platformatic/node" }'
  })

  const loaded = await load(root)

  strictEqual(loaded.config.applications.length, 2)
  strictEqual(loaded.config.applications.some(application => application.id === 'frontend'), true)
  strictEqual(loaded.config.applications.some(application => application.id === 'other'), true)
})

test('an autoloaded entry still merges into an explicit one of the same id', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "root", "type": "module" }',
    'watt.config.js':
      'export default { autoload: { path: "./web" }, applications: [{ id: "frontend", workers: 3 }] }',
    'web/frontend/package.json': '{ "name": "frontend", "type": "module" }',
    'web/frontend/watt.config.js': 'export default { module: "@platformatic/node" }'
  })

  const loaded = await load(root)

  /*
    The shallow explicit-wins merge is v3 semantics and stays what it was: a rule for an autoloaded
    entry meeting an explicit one, which is a different situation from two directories colliding.
  */
  strictEqual(loaded.config.applications.length, 1)
  strictEqual(loaded.config.applications[0].workers, 3)
})
