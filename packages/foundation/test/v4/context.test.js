import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createConfigurationContext, defaultMode, isProductionCommand } from '../../lib/v4/index.js'

test('production is true under start and build, and mode follows it', () => {
  // build produces production artifacts, which is why it carries the shortcut too.
  ok(isProductionCommand('start'))
  ok(isProductionCommand('build'))
  ok(!isProductionCommand('dev'))
  ok(!isProductionCommand('exec'))

  strictEqual(defaultMode('dev'), 'development')
  strictEqual(defaultMode('build'), 'production')
  strictEqual(defaultMode('start'), 'production')
  strictEqual(defaultMode('exec'), 'development')
  strictEqual(defaultMode('exec', true), 'production')
  strictEqual(defaultMode('start', false), 'development')
})

test('--mode overrides the default without changing production', () => {
  const context = createConfigurationContext({ command: 'build', mode: 'staging', root: '/proj' })

  strictEqual(context.mode, 'staging')
  strictEqual(context.production, true)
})

test('the context and its env are frozen, not merely typed readonly', () => {
  // One context object is handed to every callback in a file, so a config that wrote to ctx.env
  // would change what later deferred entries observe and make the result depend on evaluation
  // order — without tripping the process.env mutation warning, which watches a different object.
  const context = createConfigurationContext({ command: 'dev', root: '/proj', env: { A: '1' } })

  ok(Object.isFrozen(context))
  ok(Object.isFrozen(context.env))
  throws(() => {
    'use strict'
    context.env.A = '2'
  }, TypeError)
  throws(() => {
    'use strict'
    context.mode = 'other'
  }, TypeError)
})

test('ctx.env is a snapshot, so later writes to the source are not visible through it', () => {
  const source = { A: '1' }
  const context = createConfigurationContext({ command: 'dev', root: '/proj', env: source })

  source.A = '2'
  source.B = 'new'

  deepStrictEqual(context.env, { A: '1' })
})

test('addWatchFile resolves relative paths against ctx.root and returns nothing', () => {
  const declared = []
  const context = createConfigurationContext({
    command: 'dev',
    root: '/proj',
    onWatchFile: path => declared.push(path)
  })

  // ctx.root is the only stable referent: a helper that calls this may live anywhere, and
  // process.cwd() is wherever the command was typed.
  strictEqual(context.addWatchFile('./config/ports.json'), undefined)
  context.addWatchFile(resolve('/elsewhere', 'shared.json'))

  deepStrictEqual(declared, [resolve('/proj', 'config/ports.json'), resolve('/elsewhere', 'shared.json')])
})

test('addWatchFile is a no-op outside a watching command', () => {
  // Which keeps a config that calls it from behaving differently under start.
  const context = createConfigurationContext({ command: 'start', root: '/proj' })

  strictEqual(context.addWatchFile('./ports.json'), undefined)
})
