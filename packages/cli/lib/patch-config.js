import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { patchConfig as wattPatchConfig } from 'wattpm'

export async function patchConfig (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c',
      patch: 'p'
    },
    string: ['config', 'patch']
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

    await wattPatchConfig(logger, configManager.fullPath, args.patch)

    logger.info('✅ Patch executed correctly.')
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}
