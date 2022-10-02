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

test('migrate up & down specifying a version with "to"', async ({ rejects, match, teardown }) => {
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

test('migrations rollback', async ({ rejects, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  {
    // apply all migrations
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
    match(sanitized, '002.do.sql')
    match(sanitized, '003.do.sql')
  }

  // Down to no migrations applied
  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    console.log(stdout)
    const sanitized = stripAnsi(stdout)
    match(sanitized, '003.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    console.log(stdout)
    const sanitized = stripAnsi(stdout)
    match(sanitized, '002.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    console.log(stdout)
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    console.log(stdout)
    const sanitized = stripAnsi(stdout)
    match(sanitized, 'No migrations to rollback')
  }

  // ...and back!
  {
    // apply all migrations
    const { stdout } = await execa('node', [cliPath, '-c', getFixturesConfigFileLocation('multiple-migrations.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
    match(sanitized, '002.do.sql')
    match(sanitized, '003.do.sql')
  }
})
