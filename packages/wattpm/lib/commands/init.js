import { ConfigManager } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { schema, version } from '../schema.js'
import { parseArgs, verbose } from '../utils.js'

export async function initCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  const root = resolve(process.cwd(), positionals[0] ?? '')
  const web = resolve(root, 'web')
  const configurationFile = resolve(root, 'wattpm.json')

  // Create the web folder, will implicitly create the root
  try {
    await mkdir(web, { recursive: true, maxRetries: 10, retryDelay: 1000 })
  } catch (error) {
    logger.fatal(
      verbose ? { error: ensureLoggableError(error) } : undefined,
      `Cannot create folder ${web}: ${error.message}`
    )
  }

  // Write the configuration file - Using a ConfigManager will automatically insert defaults
  const configManager = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: 3042
      },
      logger: {
        level: 'info'
      },
      entrypoint: '',
      autoload: {
        path: 'web'
      }
    },
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
        private: true,
        scripts: {
          dev: 'wattpm dev',
          build: 'wattpm build',
          start: 'wattpm start'
        },
        dependencies: {
          wattpm: `^${version}`
        }
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
