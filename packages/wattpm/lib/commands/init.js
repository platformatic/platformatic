import { saveConfigurationFile } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { existsSync } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defaultConfiguration, defaultEnv, defaultPackageJson } from '../defaults.js'
import { gitignore } from '../gitignore.js'
import { schema, version } from '../schema.js'
import { getRoot, parseArgs, verbose } from '../utils.js'

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

  const root = getRoot(positionals)
  const web = resolve(root, 'web')
  const configurationFile = resolve(root, 'watt.json')

  // Check that the none of the files to be created already exist
  if (existsSync(root)) {
    const statObject = await stat(root)

    if (!statObject.isDirectory()) {
      logger.fatal(`Path ${bold(root)} exists but it is not a directory.`)
      return
    }

    const webFolder = resolve(root, 'web')

    if (existsSync(webFolder)) {
      const statObject = await stat(webFolder)

      if (!statObject.isDirectory()) {
        logger.fatal(`Path ${bold(webFolder)} exists but it is not a directory.`)
        return
      }
    }

    for (const file of ['watt.json', 'package.json', '.gitignore']) {
      if (existsSync(resolve(root, file))) {
        logger.fatal(`Path ${bold(resolve(root, file))} already exists.`)
        return
      }
    }
  }

  // Create the web folder, will implicitly create the root
  try {
    await mkdir(web, { recursive: true })
    /* c8 ignore next 8 */
  } catch (error) {
    logger.fatal(
      verbose ? { error: ensureLoggableError(error) } : undefined,
      `Cannot create folder ${web}: ${error.message}`
    )
    return
  }

  await saveConfigurationFile(configurationFile, {
    $schema: schema.$id,
    ...defaultConfiguration,
    entrypoint: positionals[1] ?? undefined
  })

  await writeFile(resolve(root, '.env.sample'), defaultEnv, 'utf-8')
  await writeFile(resolve(root, '.env'), defaultEnv, 'utf-8')

  const packageJson = {
    name: basename(root),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` }
  }

  if (packageManager === 'npm') {
    packageJson.workspaces = ['web/*', 'external/*']
  } else if (packageManager === 'pnpm') {
    await saveConfigurationFile(resolve(root, 'pnpm-workspace.yaml'), { packages: ['web/*', 'external/*'] })
  }

  // Write the package.json file
  await saveConfigurationFile(resolve(root, 'package.json'), packageJson)

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
        usage: 'p, --package-manager <executable>',
        description: 'Use an alternative package manager'
      }
    ]
  }
}
