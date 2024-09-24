import { ConfigManager } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defaultConfiguration, defaultPackageJson } from '../defaults.js'
import { schema, version } from '../schema.js'
import { checkEmptyDirectory, parseArgs, verbose } from '../utils.js'
import { gitignore } from '../gitignore.js'

export async function initCommand (logger, args) {
  const {
    values: { 'package-manager': packageManager },
    positionals
  } = parseArgs(
    args,
    {
      'package-manager': {
        type: 'string',
        short: 'p',
        default: 'npm'
      }
    },
    false
  )

  /* c8 ignore next */
  const root = resolve(process.cwd(), positionals[0] ?? '')
  const web = resolve(root, 'web')
  const configurationFile = resolve(root, 'watt.json')

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
    JSON.stringify({ $schema: schema.$id, ...configManager.current, entrypoint: positionals[1] ?? '' }, null, 2),
    'utf-8'
  )

  const packageJson = {
    name: basename(root),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` }
  }

  if (packageManager === 'npm') {
    packageJson.workspaces = ['web/*']
  } else if (packageManager === 'pnpm') {
    await writeFile(resolve(root, 'pnpm-workspace.yaml'), "packages:\n  - 'web/*'", 'utf-8')
  }

  // Write the package.json file
  await writeFile(resolve(root, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')

  // Write the .gitignore file
  await writeFile(resolve(root, '.gitignore'), gitignore, 'utf-8')

  logger.done(`Created a wattpm application in ${bold(root)}.`)
}

export const help = {
  init: {
    usage: 'init [root] [entrypoint]',
    description: 'Creates a new application',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      },
      {
        name: 'entrypoint',
        description: 'The name of the entrypoint service'
      }
    ]
  }
}
