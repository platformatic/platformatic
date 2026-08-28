import { kMetadata, loadConfiguration } from '@platformatic/foundation'
import { transform } from '../config.js'
import { schema } from '../schema.js'

/*
  The configuration a capability command works on.

  v4 hands a command the application's already-resolved configuration as data -- the loader
  evaluated it once, main-side, and validated it against this capability's schema. There is nothing
  to read from disk, and `resolved` says so: what is left to do is apply the capability's own
  `transform` and attach the metadata the command reads `root` from.

  It used to take a path and load it. In v4 the entry carries no path -- `prepareV4Application`
  moves the configuration into `resolvedConfig` and clears `config` -- so every one of these
  commands was calling the loader with `undefined` and failing on "Source missing" before it did
  anything.
*/
export function resolveCommandConfiguration (configuration, context) {
  const root = context?.application?.path ?? process.cwd()

  /*
    `resolved` only for the object. A path is a file nobody has read yet, so it still needs the full
    load -- validation for its defaults above all, which is what these commands read
    `types.autogenerate` and the migrations directory from.
  */
  if (typeof configuration === 'string') {
    return loadConfiguration(configuration, schema, { transform })
  }

  return loadConfiguration(configuration, schema, { transform, resolved: true, root })
}

export { kMetadata }
