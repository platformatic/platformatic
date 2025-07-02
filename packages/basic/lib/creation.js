import { resolveStackable } from './config.js'
import { importStackableAndConfig } from './modules.js'

export function sanitizeCreationArguments (root, opts, context) {
  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  return { opts, context }
}

export async function buildStackable (opts) {
  const hadConfig = !!opts.config
  const { stackable, config } = await importStackableAndConfig(opts.context.directory, opts.config, opts.context)
  opts.config = config

  if (!hadConfig && typeof stackable.createDefaultConfig === 'function') {
    opts.config = await stackable.createDefaultConfig(opts)
  }

  return stackable.buildStackable(opts)
}

export async function create (fileOrDirectory, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(fileOrDirectory, sourceOrConfig)
  const { stackable } = await importStackableAndConfig(root, source, context)

  return stackable.create(root, source, opts, context)
}
