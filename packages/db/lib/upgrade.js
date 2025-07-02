'use strict'

const { join } = require('path')
const zeroSixteen = require('@platformatic/service/lib/versions/0.16.0.js')

async function upgrade (config, version) {
  const { semgrator, loadMigrationsFromPath } = await import('semgrator')

  const iterator = loadMigrationsFromPath(join(__dirname, 'versions'))

  const migrations = [zeroSixteen]

  for await (const migration of iterator) {
    migrations.push(migration)
  }

  const res = semgrator({
    version,
    migrations,
    input: config,
    logger: this.logger.child({ name: '@platformatic/db' })
  })

  let result

  for await (const updated of res) {
    result = updated.result
  }

  return result
}

module.exports = { upgrade }
