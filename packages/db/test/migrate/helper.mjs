import { join } from 'desm'
import createConnectionPool from '@databases/pg'
import { cleanSQLite } from '../cli/helper.js'

const cliPath = join(import.meta.url, '..', '..', 'lib', 'migrate.mjs')

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

  return db
}

function removeFileProtocol (str) {
  return str.replace('file:', '')
}

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(join(import.meta.url, '..', '..', 'fixtures', ...subdirectories, filename))
}

export {
  cliPath,
  cleanSQLite,
  connectAndResetDB,
  getFixturesConfigFileLocation
}
