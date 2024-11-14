import { ConfigManager } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { existsSync } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defaultConfiguration, defaultPackageJson } from '../defaults.js'
import { gitignore } from '../gitignore.js'
import { schema, version } from '../schema.js'
import { parseArgs, saveConfigurationFile, verbose } from '../utils.js'

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

  // Check that the none of the files to be created already exist
  if (existsSync(root)) {
    const statObject = await stat(root)

    if (!statObject.isDirectory()) {
      logger.fatal(`Path ${bold(root)} exists but it is not a directory.`)
    }

    const webFolder = resolve(root, 'web')

    if (existsSync(webFolder)) {
      const statObject = await stat(webFolder)

      if (!statObject.isDirectory()) {
        logger.fatal(`Path ${bold(webFolder)} exists but it is not a directory.`)
      }
    }

    for (const file of ['watt.json', 'package.json', '.gitignore']) {
      if (existsSync(resolve(root, file))) {
        logger.fatal(`Path ${bold(resolve(root, file))} already exists.`)
      }
    }
  }

  // Create the web folder, will implicitly create the root
  try {
    await mkdir(web, { recursive: true })
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

  await saveConfigurationFile(logger, configurationFile, {
    $schema: schema.$id,
    ...configManager.current,
    entrypoint: positionals[1] ?? undefined
  })

  const packageJson = {
    name: basename(root),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` }
  }

  if (packageManager === 'npm') {
    packageJson.workspaces = ['web/*', 'web.resolved/*']
  } else if (packageManager === 'pnpm') {
    await saveConfigurationFile(logger, resolve(root, 'pnpm-workspace.yaml'), { packages: ['web/*', 'web.resolved/*'] })
  }

  // Write the package.json file
  await saveConfigurationFile(logger, resolve(root, 'package.json'), packageJson)

  // Write the .gitignore file
  await writeFile(resolve(root, '.gitignore'), gitignore, 'utf-8')

  logger.done(`Created a watt application in ${bold(root)}.`)
}

export const help = {
  init: {
    usage: 'init [root] [entrypoint]',
    description: 'Creates a new application',
    args: [
      {
        name: 'root',
        description: 'The directory where to create the application (the default is the current directory)'
      },
      {
        name: 'entrypoint',
        description: 'The name of the entrypoint service'
      }
    ],
    options: [
      {
        usage: 'p, --package-manager',
        description: 'Use an alternative package manager'
      }
    ]
  }
}
