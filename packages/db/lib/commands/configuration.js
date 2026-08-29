import { kMetadata } from '@platformatic/foundation'
import { applyResolvedConfiguration, loadApplicationConfigurationFile } from '@platformatic/foundation/lib/v4/index.js'
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
export async function resolveCommandConfiguration (configuration, context) {
  const root = context?.application?.path ?? process.cwd()

  /*
    A path is a file nobody has read yet, so it is evaluated first -- by the same loader a boot
    uses, since the file is a program and there is no document to parse. What comes back is the
    application's validated configuration, which is exactly what the object form already carries,
    so both forms converge here.
  */
  if (typeof configuration === 'string') {
    const application = await loadApplicationConfigurationFile(configuration, {
      // This package's own position is the fallback for resolving its schema: an application that
      // does not carry @platformatic/db in its dependencies is still one these commands run on.
      runtimeScope: import.meta.filename
    })

    return applyResolvedConfiguration(application.root, application.config, {
      schema,
      transform,
      env: application.env,
      context
    })
  }

  return applyResolvedConfiguration(root, configuration, { schema, transform, context })
}

export { kMetadata }
