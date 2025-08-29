import {
  ensureLoggableError,
  extractModuleFromSchemaUrl,
  findRuntimeConfigurationFile,
  getParser,
  getRoot,
  getStringifier,
  listRecognizedConfigurationFiles,
  loadConfigurationFile,
  loadModule,
  logFatalError,
  parseArgs,
  safeRemove,
  saveConfigurationFile,
} from '@platformatic/foundation'
import { create } from '@platformatic/runtime'
import jsonPatch from 'fast-json-patch'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

async function patchFile (path, patch) {
  let config = getParser(path)(await readFile(path, 'utf-8'))
  config = jsonPatch.applyPatch(config, patch).newDocument
  await writeFile(path, getStringifier(path)(config))
}

export async function patchConfig (logger, configurationFile, patchPath) {
  let runtime
  try {
    // Determine if the configuration file is for an application or a runtime
    const config = await loadConfigurationFile(configurationFile)

    /* c8 ignore next 3 - Hard to test */
    if (!config) {
      return false
    }

    const mod = extractModuleFromSchemaUrl(config)
    const isApplication = mod.module !== '@platformatic/runtime'

    const patchFunction = await loadModule(
      createRequire(configurationFile),
      patchPath
    )

    if (typeof patchFunction !== 'function') {
      throw new Error('Patch file must export a function.')
    }

    // Create the runtime
    try {
      runtime = await create(configurationFile)
      await runtime.init()
      /* c8 ignore next 4 - Hard to test */
    } catch (error) {
      logFatalError(
        logger,
        { err: ensureLoggableError(error) },
        `Cannot load the runtime: ${error.message}`
      )
      return
    }

    // Prepare the structure for original and modified configurations files
    const parser = getParser(configurationFile)
    const original = {
      runtime: parser(await readFile(configurationFile, 'utf-8')),
      applications: {},
    }

    const loaded = {
      runtime: runtime.getRuntimeConfig(),
      applications: {},
    }

    const applications = Object.fromEntries(
      loaded.runtime.applications.map((application) => [
        application.id,
        application,
      ])
    )

    // Load configuration for all applications
    for (const application of loaded.runtime.applications) {
      if (!application.config) {
        const candidate = listRecognizedConfigurationFiles().find((f) =>
          existsSync(resolve(application.path, f))
        )

        if (candidate) {
          application.config = resolve(application.path, candidate)
        }
      }

      const { id, config } = application
      const parser = getParser(config)

      original.applications[id] = parser(
        await readFile(configurationFile, 'utf-8')
      )
      loaded.applications[id] = await runtime.getApplicationConfig(id, false)
    }

    // Execute the patch function
    const patches = await patchFunction(
      runtime,
      applications,
      loaded,
      original
    )

    // Apply patches
    if (typeof patches !== 'object') {
      return
    }

    if (Array.isArray(patches.runtime)) {
      if (isApplication) {
        // Create a temporary file with existing configuration
        const temporaryDir = await mkdtemp(resolve(tmpdir(), 'wattpm-patch-'))
        const temporaryFile = resolve(temporaryDir, 'watt.json')

        try {
          /* c8 ignore next - else */
          await saveConfigurationFile(
            temporaryFile,
            original.runtime.runtime ?? {}
          )
          await patchFile(temporaryFile, patches.runtime)
          await patchFile(configurationFile, [
            {
              op: 'replace',
              path: '/runtime',
              value: await loadConfigurationFile(temporaryFile),
            },
          ])
        } finally {
          await safeRemove(temporaryDir)
        }
      } else {
        await patchFile(configurationFile, patches.runtime)
      }
    }

    if (typeof patches.applications === 'object') {
      for (const [id, patch] of Object.entries(patches.applications)) {
        const config = applications[id].config

        if (Array.isArray(patch)) {
          await patchFile(config, patch)
        }
      }
    }

    return true
  } finally {
    await runtime?.close?.(true)
  }
}

export async function patchConfigCommand (logger, args) {
  const {
    values: { config },
    positionals,
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c',
      },
    },
    false
  )

  let root
  let patch

  /*
    One argument = patch file
    Two arguments = root and patch file
  */

  /* c8 ignore next 7 */
  if (positionals.length === 1) {
    root = getRoot()
    patch = positionals[0]
  } else {
    root = getRoot(positionals)
    patch = positionals[1]
  }

  const configurationFile = await findRuntimeConfigurationFile(
    logger,
    root,
    config
  )

  /* c8 ignore next 3 */
  if (!configurationFile) {
    return
  }

  try {
    const result = await patchConfig(logger, configurationFile, patch)

    if (result) {
      logger.done('Patch executed correctly.')
    }
  } catch (error) {
    return logFatalError(
      logger,
      { err: ensureLoggableError(error) },
      `Patching configuration has throw an exception: ${error.message}`
    )
  }
}

export const help = {
  'patch-config': {
    usage: 'patch-config [root] [patch]',
    description:
      'Applies a patch file to the runtime and applications configurations',
    args: [
      {
        name: 'root',
        description:
          'The process ID of the application (it can be omitted only if there is a single application running)',
      },
      {
        name: 'patch',
        description: 'The file containing the patch to execute.',
      },
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description:
          'Name of the configuration file to use (the default is watt.json)',
      },
    ],
  },
}
