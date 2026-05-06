import { ensureLoggableError, findRuntimeConfigurationFile, kMetadata, logFatalError } from '@platformatic/foundation'
import { dirname } from 'node:path'
import {
  copyStandaloneFiles,
  ensurePortableNodeModules,
  materializeRuntimeDependencies,
  prepareBundleDirectory,
  resolveOutputDirectory,
  writeBundleConfiguration,
  writeBundleMetadata
} from '../pack.js'
import { NextCapability } from '../capability.js'
import { loadConfiguration } from '../config.js'
import { resolveStandaloneEntrypoint } from '../standalone.js'

export async function packCommand (logger, configFile, args, context) {
  const {
    values: { output, 'no-build': noBuild },
    positionals
  } = context.parseArgs(
    args,
    {
      output: {
        type: 'string',
        short: 'o'
      },
      'no-build': {
        type: 'boolean'
      }
    },
    false
  )

  if (positionals.length > 0) {
    return logFatalError(logger, `Unexpected positional arguments: ${positionals.join(' ')}`)
  }

  let config
  try {
    config = await loadConfiguration(configFile)
  } catch (error) {
    return logFatalError(
      logger,
      { err: ensureLoggableError(error) },
      `Cannot load the Next.js application configuration: ${error.message}`
    )
  }

  if (config.next?.standalone !== true) {
    return logFatalError(logger, 'The Next.js pack command requires next.standalone to be set to true.')
  }

  const applicationRoot = config[kMetadata].root
  const applicationId = context.application?.id ?? 'main'
  const invocationCwd = context.cwd ?? process.cwd()
  const bundleRoot = resolveOutputDirectory(output, `.platformatic/${applicationId}-bundle`, invocationCwd)

  let standaloneEntrypoint
  try {
    standaloneEntrypoint = await resolveStandaloneEntrypoint(applicationRoot)
  } catch (error) {
    if (noBuild) {
      return logFatalError(logger, 'Cannot find a Next standalone build. Run the build first or omit --no-build.')
    }

    const capability = new NextCapability(applicationRoot, config, {
      applicationId,
      isProduction: true
    })

    try {
      logger.info(`Building application ${applicationId} before packing ...`)
      await capability.build()
      standaloneEntrypoint = await resolveStandaloneEntrypoint(applicationRoot)
    } catch (buildError) {
      return logFatalError(
        logger,
        { err: ensureLoggableError(buildError) },
        `Cannot build the Next.js application for packing: ${buildError.message}`
      )
    }
  }

  const standaloneRoot = dirname(standaloneEntrypoint)

  try {
    const runtimeConfig = await findRuntimeConfigurationFile(logger, invocationCwd, null, false, false, false)

    await prepareBundleDirectory(bundleRoot)
    await copyStandaloneFiles({ applicationRoot, standaloneRoot, bundleRoot })
    await writeBundleConfiguration(config, bundleRoot)
    const packages = await materializeRuntimeDependencies({ bundleRoot, logger })
    await writeBundleMetadata({
      applicationId,
      applicationConfig: configFile,
      runtimeConfig,
      bundleRoot,
      packages
    })
    await ensurePortableNodeModules(bundleRoot)
  } catch (error) {
    return logFatalError(
      logger,
      { err: ensureLoggableError(error) },
      `Cannot pack the Next.js application: ${error.message}`
    )
  }

  logger.done(`Packed application ${applicationId} into ${bundleRoot}.`)
}

export const helpFooter = `
This command only supports Next.js applications configured with:

- Next.js standalone output enabled in next.config.js
- next.standalone = true in the Platformatic application config

The packed output is intended to be started with:

- ./node_modules/.bin/wattpm start
`
