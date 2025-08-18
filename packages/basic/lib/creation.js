import { resolve } from './config.js'
import { importCapabilityAndConfig } from './modules.js'

export async function create (fileOrDirectory, sourceOrConfig, context) {
  const { root, source } = await resolve(fileOrDirectory, sourceOrConfig)
  const { capability } = await importCapabilityAndConfig(root, source, context)

  return capability.create(root, source, context)
}
