import { cliPath, connectAndResetDB, getFixturesConfigFileLocation } from './helper.js'
import { test } from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { once } from 'events'
import fs from 'fs/promises'
import { join, dirname } from 'path'

test('migrate on start', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()
  let found = false
  const child = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')])

  teardown(() => child.kill('SIGINT'))
  teardown(() => db.dispose())

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)running 001\.do\.sql/)) {
      found = true
      break
    }
  }
  equal(found, true)
})

test('validate migration checksums', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()
  let firstFound = false

  const firstChild = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('validate-migrations-checksums.json')])

  teardown(() => firstChild.kill('SIGINT'))
  teardown(() => db.dispose())

  const splitter = split()
  firstChild.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)running 001\.do\.sql/)) {
      firstFound = true
      break
    }
  }
  equal(firstFound, true)

  let secondFound = false
  const secondChild = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('validate-migrations-checksums.json')])

  teardown(() => secondChild.kill('SIGINT'))
  teardown(() => db.dispose())

  const secondSplitter = split()
  secondChild.stdout.pipe(secondSplitter)
  for await (const data of secondSplitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)verifying checksum of migration 001\.do\.sql/)) {
      secondFound = true
      break
    }
  }
  equal(secondFound, true)
})

test('do not validate migration checksums if not configured', async ({ equal, match, teardown }) => {
  const db = await connectAndResetDB()

  const firstChild = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')])

  teardown(() => firstChild.kill('SIGINT'))
  teardown(() => db.dispose())

  const splitter = split()
  const firstOutput = firstChild.stdout.pipe(splitter)
  const [message] = await once(firstOutput, 'data')
  match(stripAnsi(message), /(.*)running(.*)(001\.do\.sql)/)

  const secondChild = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')])
  secondChild.stderr.pipe(process.stderr)

  teardown(() => secondChild.kill('SIGINT'))

  const secondOutput = secondChild.stdout.pipe(split(JSON.parse))
  // first output should be a "server listening" message
  // no migration logging is expected
  const [{ msg }] = await once(secondOutput, 'data')
  match(msg, 'Server listening at http://127.0.0.1:')
})

test('throws if migrations directory does not exist', async ({ match }) => {
  const child = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('invalid-migrations-directory.json')])

  const output = child.stderr.pipe(split())
  const [data] = await once(output, 'data')
  match(data, /Migrations directory (.*) does not exist/)
})

test('do not run migrations by default', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()

  const firstChild = execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-auto-apply.json')])

  teardown(() => firstChild.kill('SIGINT'))
  teardown(() => db.dispose())

  const splitter = split()
  const firstOutput = firstChild.stdout.pipe(splitter)
  const [out] = await once(firstOutput, 'data')
  const { msg } = JSON.parse(out)
  equal(msg, 'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? This guide can help with debugging Platformatic DB: https://oss.platformatic.dev/docs/guides/debug-platformatic-db')

  const [{ exists }] = await db.query(db.sql(
    `SELECT EXISTS (
    SELECT FROM
        pg_tables
    WHERE
        schemaname = 'public' AND
        tablename  = 'graphs'
    );`
  ))
  equal(exists, false)
})

test('migrate creates a schema.lock file', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()
  let found = false
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await fs.unlink(expectedFile)
  } catch {}

  await execa('node', [cliPath, 'migrations', 'apply', '-c', configPath])

  teardown(async function () {
    try {
      await fs.unlink(expectedFile)
    } catch {}
  })
  teardown(() => db.dispose())

  const data = await fs.readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)

  const child = execa('node', [cliPath, 'start', '-c', configPath])
  teardown(() => child.kill('SIGINT'))

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)loaded schema lock/)) {
      found = true
      break
    }
  }
  equal(found, true)
})

test('migrate creates a schema.lock file on a different path', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await fs.unlink(expectedFile)
  } catch {}

  await execa('node', [cliPath, 'migrations', 'apply', '-c', configPath])

  teardown(async function () {
    try {
      await fs.unlink(expectedFile)
    } catch {}
  })
  teardown(() => db.dispose())

  const data = await fs.readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('start creates schema.lock if it is missing', async ({ equal, teardown }) => {
  const db = await connectAndResetDB()
  let found = false
  const configPathWithoutSchemaLock = getFixturesConfigFileLocation('no-auto-apply.json')
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await fs.unlink(expectedFile)
  } catch {}

  await execa('node', [cliPath, 'migrations', 'apply', '-c', configPathWithoutSchemaLock])

  teardown(async function () {
    try {
      await fs.unlink(expectedFile)
    } catch {}
  })
  teardown(() => db.dispose())

  const child = execa('node', [cliPath, 'start', '-c', configPath])
  teardown(() => child.kill('SIGINT'))

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)created schema lock/)) {
      found = true
      break
    }
  }
  equal(found, true)

  const data = await fs.readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('migrate does not update an existing schemalock file if no migrations have been applied', async ({ same, teardown }) => {
  const db = await connectAndResetDB()
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await fs.unlink(expectedFile)
  } catch {}

  await execa('node', [cliPath, 'migrations', 'apply', '-c', configPath])

  teardown(async function () {
    try {
      await fs.unlink(expectedFile)
    } catch {}
  })
  teardown(() => db.dispose())

  const stats1 = await fs.stat(expectedFile)

  await execa('node', [cliPath, 'migrations', 'apply', '-c', configPath])

  const stats2 = await fs.stat(expectedFile)

  same(stats1, stats2)
})
