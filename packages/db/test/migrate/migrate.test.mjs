import { test } from 'tap'
import { execa } from 'execa'
import { cliPath, connectAndResetDB, getFixturesConfigFileLocation } from './helper.mjs'
import stripAnsi from 'strip-ansi'

test('migrate up', async ({ equal, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('simple.json')])
  const sanitized = stripAnsi(stdout)
  match(sanitized, '001.do.sql')
})

test('migrate up & down', async ({ rejects, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('simple.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('simple.json'), '-t', '000'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.undo.sql')
  }
})

test('ignore versions', async ({ equal, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('simple.json')])
  const sanitized = stripAnsi(stdout)
  match(sanitized, '001.do.sql')
})
