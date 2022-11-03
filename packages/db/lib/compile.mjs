import pino from 'pino'
import pretty from 'pino-pretty'
import loadConfig from './load-config.mjs'
import { compiler } from '@platformatic/service'

async function compile (_args) {
  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  const { configManager, args } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const config = configManager.current

  try {
    await compiler.execute(logger, args, config)
    process.exit(0)
  } catch (error) {
    logger.error(error.message)
    process.exit(1)
  }
}

const compileWatch = compiler.compileWatch

export {
  compile,
  compileWatch
}
