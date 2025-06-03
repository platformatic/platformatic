#!/usr/bin/env node

import { findConfigurationFile, loadConfigurationFile } from '@platformatic/config'
import { ensureLoggableError } from '@platformatic/utils'
import { buildStackable } from '../index.js'

async function execute () {
  const root = process.cwd()
  const configurationFile = await findConfigurationFile(root)

  const stackable = await buildStackable({
    config: await loadConfigurationFile(configurationFile),
    context: {
      directory: process.cwd(),
      serverConfig: configurationFile?.runtime?.server ?? {},
      isEntrypoint: true,
      isProduction: true,
      runtimeConfig: {
        logger: {
          level: 'info',
          pretty: true
        }
      }
    }
  })

  try {
    // Set the location of the config
    const url = await stackable.start({ listen: true })
    stackable.logger.info('Server listening on %s', url)
  } catch (error) {
    stackable.logger.error({ error: ensureLoggableError(error) }, 'Error starting the application.')
  }
}

execute()
