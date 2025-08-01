import { resolve } from './config.js'
import { importStackableAndConfig } from './modules.js'

export async function create (fileOrDirectory, sourceOrConfig, context) {
  const { root, source } = await resolve(fileOrDirectory, sourceOrConfig)
  const { stackable } = await importStackableAndConfig(root, source, context)

  return stackable.create(root, source, context)
}
