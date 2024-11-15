import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { resolveServices } from 'wattpm'

export async function resolve (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c',
      username: 'u',
      password: 'p'
    },
    string: ['config', 'username', 'password']
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

    await resolveServices(logger, configManager.dirname, configManager.fullPath, args.username, args.password, false)

    logger.info('✅ All external services have been resolved')
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}
