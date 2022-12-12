import { test } from 'tap'
import { execa } from 'execa'
import { cliPath, connectAndResetDB, getFixturesConfigFileLocation } from './helper.mjs'

test('missing config', async (t) => {
  await t.rejects(execa('node', [cliPath, 'start']))
})

test('missing connectionString', async (t) => {
  await t.rejects(execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-connectionString.json')]))
})

test('missing migrations', async (t) => {
  await t.rejects(execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-migrations.json')]))
})

test('missing migrations.dir', async (t) => {
  await t.rejects(execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-migrations-dir.json')]))
})

test('not applied migrations', async (t) => {
  const db = await connectAndResetDB()
  t.teardown(() => db.dispose())

  await t.rejects(execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('bad-migrations.json')]))
})
