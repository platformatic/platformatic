import { detectApplicationType, findConfigurationFile } from '@platformatic/foundation'
import { capabilityFactories, chooseConfigurationFileName } from '@platformatic/foundation/lib/v4/index.js'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { importFile } from './utils.js'

const importCapabilityPackageMarker = '__pltImportCapabilityPackage.js'

export function isImportFailedError (error, pkg) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') {
    return false
  }

  const match = error.message.match(/Cannot find package '(.+)' imported from (.+)/)

  return match?.[1] === pkg || error.requireStack?.[0].endsWith(importCapabilityPackageMarker)
}

/*
  The canonical capability resolution order: the application's own dependencies first, with the
  runtime-bundled copy as the fallback. v3 asked the other way round — a bare import(pkg), resolved
  lexically from this package and so from the runtime's own position — and reached the application
  directory only when that threw.

  The inversion is what makes all three resolutions name the same copy by construction rather than
  by coincidence of layout: this implementation import, the main process's schema import, and the
  version stamp that compares the factory's copy against the copy this function will load. Under
  the old order the stamp could only compare a copy nobody executes.

  Nothing that resolved before stops resolving: an application with no local dependency still
  reaches the bundled copy. The answer moves in one layout — a hoisted tree where an application
  carries a nested copy of a capability the root also has — and there it now gets the copy it
  declared.
*/
export async function importCapabilityPackage (directory, pkg, { runtimeScope } = {}) {
  let imported
  try {
    try {
      // Scope to the application
      const require = createRequire(resolve(directory, importCapabilityPackageMarker))
      const toImport = require.resolve(pkg)
      imported = await importFile(toImport)
    } catch (e) {
      if (!isImportFailedError(e, pkg)) {
        throw e
      }

      /*
        Fall back to the copy bundled with the runtime -- from the runtime's own position when the
        caller says where that is. A bare import(pkg) resolves from this file, and this package
        depends on no capability, so the fallback looked for a copy in the one place it is
        guaranteed not to be. The schema import and the version-stamp check both resolve their
        fallback from the runtime, and the three have to name the same copy or a zero-config boot
        validates against a schema whose implementation the worker then cannot find.
      */
      const require = runtimeScope ? createRequire(runtimeScope) : null
      imported = require ? await importFile(require.resolve(pkg)) : await import(pkg)
    }
  } catch (e) {
    if (!isImportFailedError(e, pkg)) {
      throw e
    }

    const applicationDirectory = workerData ? relative(workerData.dirname, directory) : directory
    throw new Error(
      `Unable to import package '${pkg}'. Please add it as a dependency in the package.json file in the folder ${applicationDirectory}.`
    )
  }

  return imported.default ?? imported
}

export async function importCapabilityAndConfig (root, config, context) {
  let rootPackageJson
  try {
    rootPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    rootPackageJson = {}
  }

  const hadConfig = !!config

  if (!config) {
    config = await findConfigurationFile(root, 'application')
  }

  const appType = await detectApplicationType(root, rootPackageJson)

  if (!appType) {
    throw new Error(`Unable to detect application type in ${root}.`)
  }

  const { label, name: moduleName } = appType

  if (context) {
    const applicationRoot = relative(process.cwd(), root)

    if (!hadConfig && context.applicationId && !(await findConfigurationFile(root)) && context.worker?.index === 0) {
      const autodetectDescription =
        moduleName === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`

      const logger = pino({ level: context.loggerConfig?.level ?? 'warn', name: context.applicationId })

      logger.warn(`We have auto-detected that application "${context.applicationId}" ${autodetectDescription}.`)
      /*
        The v4 form, which is what the suggestion has to be: a configuration identifies itself by
        importing what it uses, and a `$schema` URL naming this version would be read as a stale
        stamp the moment the next major arrives.
      */
      const factory = capabilityFactories[moduleName]
      const suggestion = factory
        ? `exporting ${factory}() from "${moduleName}"`
        : `exporting { module: "${moduleName}" }`

      logger.warn(
        `We suggest you create a ${chooseConfigurationFileName(applicationRoot)} in the folder ${applicationRoot} ${suggestion}.`
      )
      logger.warn(`Also don't forget to add "${moduleName}" to the application dependencies.`)
      logger.warn('You can also run "wattpm import" to do this automatically.\n')
    }
  }

  const capability = await importCapabilityPackage(root, moduleName)

  return {
    capability,
    config,
    autodetectDescription:
      moduleName === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`,
    moduleName
  }
}
