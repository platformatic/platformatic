import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

async function updateConfigFile (path, update) {
  const contents = JSON.parse(await readFile(path, 'utf-8'))
  await update(contents)
  await writeFile(path, JSON.stringify(contents, null, 2), 'utf-8')
}

export async function applicationsAddCommand (logger, args) {
  const {
    values: { save },
    positionals: allPositionals
  } = parseArgs(
    args,
    {
      save: {
        type: 'boolean',
        short: 's'
      }
    },
    false
  )

  const client = new RuntimeApiClient({ logger, socket: this.socket })
  try {
    const [runtime, applications] = await getMatchingRuntime(client, allPositionals)
    // The metadata endpoint carries what this needs. Reading the whole runtime configuration over
    // HTTP to get at one path was the only reason this command wanted GET /config.
    const metadata = await client.getRuntimeMetadata(runtime.pid)
    const root = metadata.projectDir

    let toAdd = []
    let added = 0

    for (let app of applications) {
      let spec

      // Determine if app is a path to a directory or file, and load accordingly
      try {
        if (!isAbsolute(app)) {
          app = resolve(root, app)
        }

        const pathStat = await stat(app)
        if (pathStat.isDirectory()) {
          spec = {
            id: basename(app),
            path: relative(root, app)
          }
        } else {
          spec = JSON.parse(await readFile(app, 'utf-8'))
        }
      } catch (err) {
        logFatalError(logger, `The path "${bold(app)}" does not exist or is not valid JSON.`)
        return
      }

      const response = await client.addApplications(runtime.pid, spec, true)
      added += response.length
      toAdd = toAdd.concat(spec)
    }

    if (save) {
      await updateConfigFile(metadata.configPath, async config => {
        config.applications = (config.applications ?? []).concat(toAdd)
      })
    }

    logger.done(`Successfully added ${added} application${added > 1 ? 's' : ''} to the application.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 7 - Hard to test */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot add applications to the application: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export async function applicationsRemoveCommand (logger, args) {
  const {
    values: { save },
    positionals
  } = parseArgs(
    args,
    {
      save: {
        type: 'boolean',
        short: 's'
      }
    },
    false
  )

  const client = new RuntimeApiClient({ logger, socket: this.socket })
  try {
    const [runtime, applications] = await getMatchingRuntime(client, positionals)

    const removed = await client.removeApplications(runtime.pid, applications)

    if (save) {
      const metadata = await client.getRuntimeMetadata(runtime.pid)
      /*
        Against the configuration's *directory*, not the file: `resolve('/a/watt.config.mjs', '../x')`
        is `/a/x` only by accident of the file name having no slashes in it. v4 hands this back
        already absolute, in which case resolve returns it untouched.
      */
      const absoluteAutoloadPath = metadata.autoload
        ? resolve(dirname(metadata.configPath), metadata.autoload.path)
        : null

      await updateConfigFile(metadata.configPath, async config => {
        // Remove applications from all relevant sections
        for (const app of removed) {
          for (const section of ['applications', 'services', 'web']) {
            if (Array.isArray(config[section])) {
              config[section] = config[section].filter(a => a.id !== app.id)
            }
          }

          if (config.autoload && absoluteAutoloadPath) {
            if (app.path.startsWith(absoluteAutoloadPath)) {
              config.autoload.exclude ??= []
              config.autoload.exclude.push(relative(absoluteAutoloadPath, app.path))
            }
          }
        }
      })
    }

    logger.done(
      `Successfully removed ${applications.length} application${applications.length > 1 ? 's' : ''} from the application.`
    )
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 7 - Hard to test */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot remove applications from the application: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export const help = {
  'applications:add': {
    usage: 'applications:add [id] <path>',
    description: 'Add new applications to a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'path',
        description: 'A folder containing an application or a JSON file containing the applications to add'
      }
    ],
    options: [
      {
        usage: '-s, --save',
        description: 'Save the added applications to the application configuration file'
      }
    ]
  },
  'applications:remove': {
    usage: 'applications:remove [id] [applications...]',
    description: 'Remove applications from a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'applications',
        description: 'The list of applications to remove'
      }
    ],
    options: [
      {
        usage: '-s, --save',
        description: 'Remove the removed applications from the application configuration file'
      }
    ]
  }
}
