import { abstractLogger } from '@platformatic/foundation'
import { resolve } from 'node:path'
import { semgrator } from 'semgrator'

export async function upgrade (logger, config, version) {
  const iterator = semgrator({
    version,
    path: resolve(import.meta.dirname, 'versions'),
    input: config,
    logger: logger?.child({ name: '@platformatic/composer' }) ?? abstractLogger
  })

  let result

  for await (const updated of iterator) {
    result = updated.result
  }

  return result
}
