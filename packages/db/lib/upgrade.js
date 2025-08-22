import { abstractLogger } from '@platformatic/foundation'
import zeroSixteen from '@platformatic/service/lib/versions/0.16.0.js'
import { join } from 'node:path'
import { loadMigrationsFromPath, semgrator } from 'semgrator'

export async function upgrade (logger, config, version) {
  const iterator = loadMigrationsFromPath(join(import.meta.dirname, 'versions'))

  const migrations = [zeroSixteen]

  for await (const migration of iterator) {
    migrations.push(migration)
  }

  const res = semgrator({
    version,
    migrations,
    input: config,
    logger: logger?.child({ name: '@platformatic/db' }) ?? abstractLogger
  })

  let result

  for await (const updated of res) {
    result = updated.result
  }

  return result
}
