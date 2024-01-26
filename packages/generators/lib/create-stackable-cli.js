'use strict'

const JS_STACKABLE_START_CLI = `\
'use strict'

const stackable = require('../index')
const { start } = require('@platformatic/service')
const { printAndExitLoadConfigError } = require('@platformatic/config')

start(stackable, process.argv.splice(2)).catch(printAndExitLoadConfigError)
`

const TS_STACKABLE_START_CLI = `\
import stackable from '../index'
import { start } from '@platformatic/service'
import { printAndExitLoadConfigError } from '@platformatic/config'

start(stackable, process.argv.splice(2)).catch(printAndExitLoadConfigError)
`

const JS_STACKABLE_CREATE_CLI = `\
'use strict'

const { join } = require('node:path')
const pino = require('pino')
const pretty = require('pino-pretty')
const minimist = require('minimist')
const { Generator } = require('../lib/generator')

async function execute () {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = minimist(process.argv.slice(2), {
    string: ['dir', 'port', 'hostname'],
    boolean: ['typescript', 'install', 'plugin', 'git'],
    default: {
      dir: join(process.cwd(), 'app'),
      port: 3042,
      hostname: '0.0.0.0',
      plugin: true,
      typescript: false,
      git: false,
      install: true
    }
  })

  const generator = new Generator({ logger })

  generator.setConfig({
    port: args.port,
    hostname: args.hostname,
    plugin: args.plugin,
    tests: args.plugin,
    typescript: args.typescript,
    initGitRepository: args.git,
    targetDirectory: args.dir
  })

  await generator.prepare()
  await generator.writeFiles()

  logger.info('Application created successfully! Run \`npm run start\` to start an application.')
}

execute()
`

const TS_STACKABLE_CREATE_CLI = `\
import { join } from 'node:path'
import pino from 'pino'
import pretty from 'pino-pretty'
import minimist from 'minimist'
import { Generator } from '../lib/generator'

async function execute () {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = minimist(process.argv.slice(2), {
    string: ['dir', 'port', 'hostname'],
    boolean: ['typescript', 'install', 'plugin', 'git'],
    default: {
      dir: join(process.cwd(), 'app'),
      port: 3042,
      hostname: '0.0.0.0',
      plugin: true,
      typescript: false,
      git: false,
      install: true
    }
  })

  const generator = new Generator({ logger })

  generator.setConfig({
    port: args.port,
    hostname: args.hostname,
    plugin: args.plugin,
    tests: args.plugin,
    typescript: args.typescript,
    initGitRepository: args.git,
    targetDirectory: args.dir
  })

  await generator.prepare()
  await generator.writeFiles()

  logger.info('Application created successfully! Run \`npm run start\` to start an application.')
}

execute()
`
function generateStackableCli (typescript) {
  if (typescript) {
    return [
      {
        path: 'cli',
        file: 'start.ts',
        contents: TS_STACKABLE_START_CLI
      },
      {
        path: 'cli',
        file: 'create.ts',
        contents: TS_STACKABLE_CREATE_CLI
      }
    ]
  }

  return [
    {
      path: 'cli',
      file: 'start.js',
      contents: JS_STACKABLE_START_CLI
    },
    {
      path: 'cli',
      file: 'create.js',
      contents: JS_STACKABLE_CREATE_CLI
    }
  ]
}

module.exports = {
  generateStackableCli
}
