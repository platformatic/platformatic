import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { installDependencies } from 'wattpm/lib/commands/build.js'

export async function install (argv) {
  const args = parseArgs(argv, {
    alias: {
      production: 'p',
      'package-manager': 'P'
    },
    boolean: ['production'],
    string: ['package-manager']
  })

  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  try {
    const store = new Store({
      cwd: process.cwd(),
      logger
    })
    store.add(platformaticRuntime)

    const { configManager } = await store.loadConfig({
      config: args.config,
      overrides: {
        onMissingEnv () {
          return ''
        }
      }
    })

    const installed = await installDependencies(
      logger,
      configManager.dirname,
      configManager.fullPath,
      args.production,
      args['package-manager']
    )

    if (installed) {
      logger.info('✅ All dependencies have been installed')
    }
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}
