import { test } from 'tap'
import { execa } from 'execa'
import { cliPath, connectAndResetDB, getFixturesConfigFileLocation } from './helper.mjs'
import stripAnsi from 'strip-ansi'

test('missing config', async (t) => {
  await t.rejects(execa('node', [cliPath]))
})

test('missing connectionString', async (t) => {
  await t.rejects(execa('node', [cliPath, '-c', getFixturesConfigFileLocation('no-connectionString.json')]))
})

test('missing migrations', async (t) => {
  await t.rejects(execa('node', [cliPath, '-c', getFixturesConfigFileLocation('no-migrations.json')]))
})

test('missing migrations.dir', async (t) => {
  await t.rejects(execa('node', [cliPath, '-c', getFixturesConfigFileLocation('no-migrations-dir.json')]))
})

test('not applied migrations', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('bad-migrations.json')])
  const sanitized = stripAnsi(stdout)
  match(sanitized, '001.do.sql')
  match(sanitized, 'error: syntax error at end of input')
})
