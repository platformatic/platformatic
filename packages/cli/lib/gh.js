import {
  createStaticWorkspaceGHAction,
  createDynamicWorkspaceGHAction
} from 'create-platformatic'

import parseArgs from 'minimist'
import { access } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import ConfigManager from '@platformatic/config'

export const createGHAction = async (logger, env, config, buildTS, type, projectDir = process.cwd()) => {
  if (type === 'static') {
    await createStaticWorkspaceGHAction(logger, env, config, projectDir, buildTS)
    return
  }
  await createDynamicWorkspaceGHAction(logger, env, config, projectDir, buildTS)
}

const logger = pino(pretty({
  translateTime: 'SYS:HH:MM:ss',
  ignore: 'hostname,pid'
}))

const configFileNames = ConfigManager.listConfigFiles()

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

export const gh = async (argv) => {
  const args = parseArgs(argv, {
    default: {
      type: 'static',
      build: false
    },
    alias: {
      config: 'c',
      type: 't',
      help: 'h',
      build: 'b'
    },
    boolean: ['build']
  })

  if (!['static', 'dynamic'].includes(args.type)) {
    logger.error(`Invalid type: [${args.type}]. Type must be either static or dynamic`)
    process.exit(1)
  }

  let configFilename = args.config
  if (!configFilename) {
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName)))
    configFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
  }

  if (!configFilename) {
    logger.error('No config file found')
    process.exit(1)
  }

  if (await isFileAccessible('.env')) {
    // We cannot add this automatically, because there might be credentials .env file
    logger.info('Found .env file. If you need these variables in your GitHub Action, please add them to env: in "Deploy Project" step')
  }

  const env = {
    plt_custom_variable: 'change-me',
    custom_variable1: 'change-me'
  }
  await createGHAction(logger, env, configFilename, args.build, args.type)

  const workspaceName = args.type === 'static' ? 'PLATFORMATIC_STATIC_WORKSPACE_ID ' : 'PLATFORMATIC_DYNAMIC_WORKSPACE_ID'
  const secretName = args.type === 'static' ? 'PLATFORMATIC_STATIC_WORKSPACE_API_KEY' : 'PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY'
  logger.info(`Github action successfully created please add ${workspaceName} and ${secretName} as repository secrets.`)
}
