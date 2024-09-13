import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { buildServer } from '@platformatic/db'
import { test } from 'node:test'

const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs/promises')

let counter = 0


type testfn = Parameters<typeof test>[0]
type TestContext = Parameters<Exclude<testfn, undefined>>[0]

export async function getServer (t: TestContext) {

  const dbPath = join(os.tmpdir(), 'db-' + process.pid + '-' + counter++ + '.sqlite')
  const connectionString = 'sqlite://' + dbPath

  // We go up two folder because this files executes in the dist folder
  const config = JSON.parse(await readFile(join(__dirname, '..', '..', 'platformatic.json'), 'utf8'))
  // Add your config customizations here. For example you want to set
  // all things that are set in the config file to read from an env variable
  config.server ||= {}
  config.server.logger ||= {}
  config.server.logger.level = 'warn'
  config.watch = false

  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString

  // Add your config customizations here
  const server = await buildServer(config)
  t.after(() => server.close())

  t.after(async () => {
    await fs.unlink(dbPath)
  })

  return server
}
  