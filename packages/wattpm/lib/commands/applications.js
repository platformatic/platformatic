import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

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

  const client = new RuntimeApiClient()
  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)

    const toAdd = JSON.parse(await readFile(positionals[0], 'utf-8'))

    const added = await client.addApplications(runtime.pid, toAdd, true)

    if (save) {
      const config = await client.getRuntimeConfig(runtime.pid, true)

      await updateConfigFile(config.__metadata.path, async config => {
        config.applications = (config.applications ?? []).concat(Array.isArray(toAdd) ? toAdd : [toAdd])
      })
    }

    logger.done(`Successfully added ${added.length} application${added.length > 1 ? 's' : ''} to the application.`)
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

  const client = new RuntimeApiClient()
  try {
    const [runtime, applications] = await getMatchingRuntime(client, positionals)

    const removed = await client.removeApplications(runtime.pid, applications)

    if (save) {
      const config = await client.getRuntimeConfig(runtime.pid, true)
      const absoluteAutoloadPath = resolve(config.__metadata.path, config.autoload.path)

      await updateConfigFile(config.__metadata.path, async config => {
        // Remove applications from all relevant sections
        for (const app of removed) {
          for (const section of ['applications', 'services', 'web']) {
            if (Array.isArray(config[section])) {
              config[section] = config[section].filter(a => a.id !== app.id)
            }
          }

          if (config.autoload) {
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
    usage: 'applications:add [id] <file>',
    description: 'Add new applications to a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'file',
        description: 'The file containing the applications to add'
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
