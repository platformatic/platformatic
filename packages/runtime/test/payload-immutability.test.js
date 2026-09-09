import { deepStrictEqual, notStrictEqual, strictEqual, throws } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const configFile = join(import.meta.dirname, '..', 'fixtures', 'configs', 'monorepo', 'watt.config.mjs')

/*
  v4 nests an entire capability payload inside every entry, and the getters used to read straight
  off live state. A consumer mutating what it received would have been editing the configuration
  that later restarts and scale-up workers read — silently, and only visible as worker generations
  disagreeing about what they are running.
*/
test('the runtime configuration payload cannot be edited by its consumer', async t => {
  const app = await createRuntime(configFile)
  t.after(() => app.close())
  await app.start()

  const config = await app.getRuntimeConfig()

  throws(() => {
    config.restartOnError = 999999
  }, TypeError)

  throws(() => {
    config.applications[0].id = 'hijacked'
  }, TypeError)

  throws(() => {
    config.applications.push({ id: 'smuggled' })
  }, TypeError)

  // And the runtime is unchanged, which is the part that matters.
  const again = await app.getRuntimeConfig()
  notStrictEqual(again.applications[0].id, 'hijacked')
  strictEqual(again.applications.length, config.applications.length)
})

test('the application payloads cannot be edited by their consumer', async t => {
  const app = await createRuntime(configFile)
  t.after(() => app.close())
  await app.start()

  const topology = await app.getApplications()

  throws(() => {
    topology.applications[0].status = 'stopped'
  }, TypeError)

  const details = await app.getApplicationDetails('with-logger')

  throws(() => {
    details.id = 'hijacked'
  }, TypeError)

  const again = await app.getApplicationDetails('with-logger')
  strictEqual(again.id, 'with-logger')
  strictEqual(again.status, 'started')
  deepStrictEqual(again.dependencies, [])
})
