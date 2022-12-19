import { test } from 'tap'
import { execa } from 'execa'
import { cliPath, connectAndResetDB, getFixturesConfigFileLocation } from './helper.mjs'
import stripAnsi from 'strip-ansi'
import fs from 'fs'

test('migrate up', async ({ equal, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')])
  const sanitized = stripAnsi(stdout)
  match(sanitized, '001.do.sql')
})

test('migrate up & down specifying a version with "to"', async ({ rejects, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json'), '-t', '000'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.undo.sql')
  }
})

test('ignore versions', async ({ equal, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')])
  const sanitized = stripAnsi(stdout)
  match(sanitized, '001.do.sql')
})

test('migrations rollback', async ({ rejects, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  {
    // apply all migrations
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
    match(sanitized, '002.do.sql')
    match(sanitized, '003.do.sql')
  }

  // Down to no migrations applied
  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '003.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '002.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.undo.sql')
  }

  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'])
    const sanitized = stripAnsi(stdout)
    match(sanitized, 'No migrations to rollback')
  }

  // ...and back!
  {
    // apply all migrations
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
    match(sanitized, '002.do.sql')
    match(sanitized, '003.do.sql')
  }
})

test('after a migration, platformatic config is touched', async ({ rejects, match, teardown, notSame }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  fs.utimesSync(getFixturesConfigFileLocation('simple.json'), d, d)
  const { mtime: mtimePrev } = fs.statSync(getFixturesConfigFileLocation('simple.json'))
  {
    const { stdout } = await execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')])
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')

    const { mtime: mtimeAfter } = fs.statSync(getFixturesConfigFileLocation('simple.json'))
    notSame(mtimePrev, mtimeAfter)
  }
})
