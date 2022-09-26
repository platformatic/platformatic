import { resolve } from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import loadConfig from './load-config.mjs'
import { isFileAccessible } from './utils.js'

async function execute (logger, args, config) {
  const cwd = process.cwd()

  const tsconfigPath = resolve(cwd, 'tsconfig.json')
  const tsconfigExists = await isFileAccessible(tsconfigPath)

  if (!tsconfigExists) {
    logger.error('The tsconfig.json file was not found.')
    return
  }

  try {
    await execa('npx', ['tsc', '--project', 'tsconfig.json'], { cwd })
    logger.info('Typescript compilation completed successfully.')
  } catch (error) {
    logger.error('Failed to compile typescript files: ' + error)
    process.exit(1)
  }
}

async function compileWatch () {
  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  const cwd = process.cwd()

  const tsconfigPath = resolve(cwd, 'tsconfig.json')
  const tsconfigExists = await isFileAccessible(tsconfigPath)

  if (!tsconfigExists) {
    logger.error('The tsconfig.json file was not found.')
    process.exit(1)
  }

  return new Promise((resolve, reject) => {
    const child = execa('npx', ['tsc', '--project', 'tsconfig.json', '--watch'], { cwd })

    let tsCompilationMessages = []

    child.stdout.on('data', (data) => {
      let tsCompilerMessage = data.toString().trim()
      if (tsCompilerMessage.startsWith('\u001bc')) {
        tsCompilerMessage = tsCompilerMessage.slice(2)
      }

      if (tsCompilerMessage === '') return

      const startMessage = tsCompilerMessage.match(/.*Starting compilation in watch mode.../)
      if (startMessage !== null) {
        logger.info(tsCompilerMessage)
        return
      }

      tsCompilationMessages.push(tsCompilerMessage)

      const resultMessage = tsCompilerMessage.match(/.*Found (\d+) error.*/)
      if (resultMessage !== null) {
        const errorsCount = parseInt(resultMessage[1])
        const compilerOutput = tsCompilationMessages.join('\n')
        if (errorsCount === 0) {
          logger.info(compilerOutput)
          resolve()
        } else {
          logger.error(compilerOutput)
          reject(new Error('Typescript compilation failed'))
        }
        tsCompilationMessages = []
      }
    })
  })
}

async function compile (_args) {
  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  const { configManager, args } = await loadConfig(
    {
      default: {},
      alias: {}
    },
    _args
  )
  await configManager.parseAndValidate()
  const config = configManager.current

  await execute(logger, args, config)
}

export { compile, compileWatch, execute }
