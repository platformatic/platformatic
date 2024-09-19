import { ConfigManager } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defaultConfiguration, defaultPackageJson } from '../defaults.js'
import { schema, version } from '../schema.js'
import { checkEmptyDirectory, parseArgs, verbose } from '../utils.js'

export async function initCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  /* c8 ignore next */
  const root = resolve(process.cwd(), positionals[0] ?? '')
  const web = resolve(root, 'web')
  const configurationFile = resolve(root, 'wattpm.json')

  // Check that the target directory is empty, otherwise cloning will likely fail
  await checkEmptyDirectory(logger, root, root)

  // Create the web folder, will implicitly create the root
  try {
    await mkdir(web, { recursive: true, maxRetries: 10, retryDelay: 1000 })
    /* c8 ignore next 6 */
  } catch (error) {
    logger.fatal(
      verbose ? { error: ensureLoggableError(error) } : undefined,
      `Cannot create folder ${web}: ${error.message}`
    )
  }

  // Write the configuration file - Using a ConfigManager will automatically insert defaults
  const configManager = new ConfigManager({
    source: defaultConfiguration,
    schema,
    logger,
    fixPaths: false
  })

  await configManager.parse()

  await writeFile(
    configurationFile,
    JSON.stringify({ $schema: schema.$id, ...configManager.current }, null, 2),
    'utf-8'
  )

  // Write the package.json file
  await writeFile(
    resolve(root, 'package.json'),
    JSON.stringify(
      {
        name: basename(root),
        ...defaultPackageJson,
        dependencies: { wattpm: `^${version}` }
      },
      null,
      2
    ),
    'utf-8'
  )

  logger.done(`Created a wattpm application in ${bold(web)}.`)
}

export const help = {
  init: {
    usage: 'init [root]',
    description: 'Creates a new application',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      }
    ]
  }
}
