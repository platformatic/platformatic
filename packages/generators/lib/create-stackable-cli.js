'use strict'

const { kebabCase } = require('change-case-all')

function getJsStackableStartCli () {
  return `\
#!/usr/bin/env node
'use strict'
  
const stackable = require('../index')
const { start } = require('@platformatic/service')
const { printAndExitLoadConfigError } = require('@platformatic/config')
  
start(stackable, process.argv.splice(2)).catch(printAndExitLoadConfigError)
`
}

function getTsStackableStartCli () {
  return `\
#!/usr/bin/env node
import stackable from '../index'
import { start } from '@platformatic/service'
import { printAndExitLoadConfigError } from '@platformatic/config'

start(stackable, process.argv.splice(2)).catch(printAndExitLoadConfigError)
`
}

function getJsStackableCreateCli (stackableName) {
  return `\
#!/usr/bin/env node
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
      dir: join(process.cwd(), '${kebabCase(stackableName + '-app')}'),
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
  
  await generator.run()
  
  logger.info('Application created successfully! Run \`npm run start\` to start an application.')
}
  
execute()
`
}

function getTsStackableCreateCli (stackableName) {
  return `\
#!/usr/bin/env node
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
      dir: join(process.cwd(), '${kebabCase(stackableName + '-app')}'),
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

  await generator.run()

  logger.info('Application created successfully! Run \`npm run start\` to start an application.')
}

execute()
`
}

function generateStackableCli (typescript, stackableName) {
  if (typescript) {
    return [
      {
        path: 'cli',
        file: 'start.ts',
        contents: getTsStackableStartCli(),
        options: { mode: 0o755 }
      },
      {
        path: 'cli',
        file: 'create.ts',
        contents: getTsStackableCreateCli(stackableName),
        options: { mode: 0o755 }
      }
    ]
  }

  return [
    {
      path: 'cli',
      file: 'start.js',
      contents: getJsStackableStartCli(),
      options: { mode: 0o755 }
    },
    {
      path: 'cli',
      file: 'create.js',
      contents: getJsStackableCreateCli(stackableName),
      options: { mode: 0o755 }
    }
  ]
}

module.exports = {
  generateStackableCli
}
