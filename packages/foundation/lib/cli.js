import { bgGreen, black, bold, green, isColorSupported } from 'colorette'
import { resolve } from 'node:path'
import { parseArgs as nodeParseArgs } from 'node:util'
import { pino } from 'pino'
import pinoPretty from 'pino-pretty'
import { findConfigurationFileRecursive, loadConfigurationModule, saveConfigurationFile } from './configuration.js'
import { hasJavascriptFiles } from './file-system.js'
import { detectApplicationType, getPlatformaticVersion } from './module.js'

/* c8 ignore next 4 - else branches */
let verbose = false
let prettyPrint = true
let executableId = ''
let executableName = ''

export function isVerbose () {
  return verbose
}

export function usePrettyPrint () {
  return prettyPrint
}

export function getExecutableId () {
  return executableId
}

export function getExecutableName () {
  return executableName
}

export function setVerbose (value) {
  verbose = value
}

export function setPrettyPrint (value) {
  prettyPrint = value
}

export function setExecutableId (id) {
  executableId = id
}

export function setExecutableName (name) {
  executableName = name
}

export function logo (color = true) {
  /* c8 ignore next - else */
  const executableName = color && isColorSupported ? bold(getExecutableName()) : getExecutableName()
  const str = `

                                  //////
                               /////////////
                           ///////      ///////
                        ///////            ///////
                     ///////                  ///////
                     ////                        ////
              &&&&   ////                        ////   &&&&
           &&&&&&&   ////                        ////   &&&&&&&
        &&&&&&&      ////                        ////      &&&&&&&
        &&&&         ////                        ////         &&&&&&&
        &&&&         ////                        ////            &&&&     &&
        &&&&         ////                        ////             &&&    &&&&&&
        &&&&         ////                        ////             &&&      &&&&&&
        &&&&                 /////              /////             &&&         &&&&
        &&&&              ///////            ///////              &&&         &&&&
        &&&&              //////          ///////                 &&&      &&&&&&&
        &&&&         //// /////////   ////////                    &&&    &&&&&&
        &&&&         //// ///  ////////////      &&&&             &&&    &&&
        &&&&&&&      //// ///     /////          &&&&            &&&&
           &&&&&&&   ////                  &&&   &&&&&        &&&&&&&
              &&&    ////                 &&&&    &&&&&&&  &&&&&&&
                     //// &&&             &&&&       &&&&&&&&&&
                     //// &&&             &&&&          &&&&
                      //  &&&&&           &&&&
                           &&&&&&&      &&&&&&
                              &&&&&&&&&&&&&
                                  &&&&&&

                            Welcome to ${executableName}!
`

  /* c8 ignore next - else */
  return color && isColorSupported ? str.replace(/\//g, s => green(s)) : str
}

export function createCliLogger (level, noPretty) {
  let pretty

  if (noPretty) {
    setPrettyPrint(false)
  } else {
    pretty = pinoPretty({
      colorize: process.env.NO_COLOR !== 'true',
      customPrettifiers: {
        level (logLevel, _u1, _u2, { label, labelColorized }) {
          /* c8 ignore next - else */
          return logLevel === 35 ? bgGreen(black(label)) : labelColorized
        }
      },
      sync: true
    })
  }

  return pino(
    {
      level,
      customLevels: {
        done: 35
      }
    },
    pretty
  )
}

export function logFatalError (logger, ...args) {
  process.exitCode = 1
  logger.fatal(...args)
  return false
}

export function parseArgs (args, options, stopAtFirstPositional = true, strict = true) {
  let unparsed = []

  if (stopAtFirstPositional) {
    // Parse a first time to get tokens and see where the first positional, if any, is
    const { tokens } = nodeParseArgs({
      args,
      options,
      allowPositionals: true,
      allowNegative: false,
      strict: false,
      tokens: true
    })

    const firstPositional = tokens.find(t => t.kind === 'positional')

    if (firstPositional) {
      unparsed = args.slice(firstPositional.index)
      args = args.slice(0, firstPositional.index)
    }
  }

  const { tokens, values, positionals } = nodeParseArgs({
    args,
    options,
    allowPositionals: true,
    allowNegative: false,
    strict,
    tokens: true
  })

  return {
    values,
    positionals,
    unparsed,
    tokens
  }
}

export function getRoot (positionals) {
  let root = process.cwd()

  if (positionals?.[0]) {
    root = resolve(root, positionals[0])
  }

  return root
}

export function applicationToEnvVariable (application) {
  return `PLT_APPLICATION_${application.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}_PATH`
}

export async function findRuntimeConfigurationFile (
  logger,
  root,
  configurationFile,
  fallback = true,
  throwOnError = true,
  verifyPackages = true
) {
  let configFile = await findConfigurationFileRecursive(root, configurationFile, '@platformatic/runtime')

  // If a runtime was not found, search for application file that we wrap in a runtime
  if (!configFile && !configurationFile) {
    configFile = await findConfigurationFileRecursive(root, configurationFile)
  }

  // No configuration yet, try to create a new one
  if (!configFile) {
    if (fallback) {
      configurationFile = await fallbackToTemporaryConfigFile(logger, root, verifyPackages)

      /* c8 ignore next - else */
      if (configurationFile || configurationFile === false) {
        return configurationFile
      }
    }

    if (throwOnError) {
      return logFatalError(
        logger,
        `Cannot find a supported ${getExecutableName()} configuration file (like ${bold('watt.json')}, a ${bold('wattpm.json')} or a ${bold(
          'platformatic.json'
        )}) in ${bold(resolve(root))}.`
      )
    }
  }

  return configFile
}

export async function fallbackToTemporaryConfigFile (logger, root, verifyPackages) {
  const hasJsFiles = await hasJavascriptFiles(root)

  if (!hasJsFiles) {
    // Do not return false here, that is reserved below to signal that a file was created but no module was available.
    return
  }

  const { name, label } = await detectApplicationType(root)

  /* c8 ignore next - else */
  const autodetectDescription = name === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`

  logger.warn(
    `We have auto-detected that the current folder ${bold(autodetectDescription)} so we have created a ${bold('watt.json')} file for you automatically.`
  )

  const schema = `https://schemas.platformatic.dev/${name}/${await getPlatformaticVersion()}.json?autogenerated=true`
  const configurationFile = resolve(root, 'watt.json')
  await saveConfigurationFile(configurationFile, { $schema: schema })

  // Try to load the module, if it is missing, we will throw an error
  if (verifyPackages) {
    try {
      await loadConfigurationModule(root, { $schema: schema })
      /* c8 ignore next 4 - covered */
    } catch (error) {
      logFatalError(logger, `Cannot load module ${bold(name)}. Please add it to your package.json and try again.`)
      return false
    }
  }

  return configurationFile
}
