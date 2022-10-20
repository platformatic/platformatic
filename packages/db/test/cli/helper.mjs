import why from 'why-is-node-running'
import { Agent, setGlobalDispatcher } from 'undici'
import { join } from 'desm'
import createConnectionPool from '@databases/pg'
import { on } from 'events'
import { execa } from 'execa'
import { setTimeout as sleep } from 'timers/promises'
import split from 'split2'
import { rm } from 'fs/promises'

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 20000).unref()

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

const cliPath = join(import.meta.url, '..', '..', 'db.mjs')

async function connectAndResetDB () {
  // TODO support other databases
  const db = await createConnectionPool({
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres',
    bigIntMode: 'string',
    max: 1
  })

  try {
    await db.query(db.sql`DROP TABLE pages`)
  } catch (err) {
  }

  try {
    await db.query(db.sql`DROP TABLE graphs`)
  } catch (err) {
  }

  try {
    await db.query(db.sql`DROP TABLE versions`)
  } catch (err) {
  }

  try {
    await db.query(db.sql`DROP TABLE pages`)
  } catch (err) {
  }

  try {
    await db.query(db.sql`DROP TABLE categories`)
  } catch {
  }

  try {
    await db.query(db.sql`DROP TABLE posts`)
  } catch {
  }

  try {
    await db.query(db.sql`DROP TABLE simple_types`)
  } catch {
  }

  try {
    await db.query(db.sql`DROP TABLE owners`)
  } catch {
  }

  try {
    await db.query(db.sql`DROP TABLE graphs`)
  } catch {
  }

  return db
}

async function start (...args) {
  const child = execa('node', [cliPath, ...args])
  const output = child.stdout.pipe(split(function (line) {
    try {
      const obj = JSON.parse(line)
      return obj
    } catch (err) {
      console.log(line)
    }
  }))
  child.ndj = output

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 5000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      const url = message.url
      if (url !== undefined) {
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}

function removeFileProtocol (str) {
  return str.replace('file:', '')
}

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(join(import.meta.url, '..', 'fixtures', ...subdirectories, filename))
}

async function cleanSQLite (dbLocation, i = 0) {
  if (i === 5) {
    throw new Error('too many EBUSY')
  }
  i++
  try {
    await rm(dbLocation)
  } catch (err) {
    console.log('error cleaning up the file', err.code, err.message)

    if (err.code === 'ENOENT') {
      return
    }

    if (err.code === 'EBUSY') {
      await sleep(i * 1000)
      return cleanSQLite(dbLocation, i)
    }
  }
}

export {
  cliPath,
  start,
  cleanSQLite,
  connectAndResetDB,
  getFixturesConfigFileLocation
}
