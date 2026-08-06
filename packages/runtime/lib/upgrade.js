import { abstractLogger } from '@platformatic/foundation'
import { join } from 'node:path'
import { lt } from 'semver'
import { semgrator } from 'semgrator'

export async function upgrade (logger, config, version) {
  const runtimeLogger = logger?.child({ name: '@platformatic/runtime' }) ?? abstractLogger

  const schema = config.$schema
  const isRuntimeSchema =
    !schema ||
    /(?:^|\/)(?:@platformatic\/)?runtime(?:\/|$)/.test(schema) ||
    /(?:^|\/)wattpm(?:\/|$)/.test(schema)

  if (isRuntimeSchema && config.server && lt(version, '4.0.0')) {
    runtimeLogger.warn(
      'Runtime v4 no longer supports a root server configuration. Move it into the configuration of the capability that owns the listener.'
    )
  }

  const iterator = semgrator({
    version,
    path: join(import.meta.dirname, 'versions'),
    input: config,
    logger: runtimeLogger
  })

  let result

  for await (const updated of iterator) {
    result = updated.result
  }

  return result
}
