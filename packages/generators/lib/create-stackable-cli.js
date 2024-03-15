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
const { parseArgs } = require('node:util')
const { Generator } = require('../lib/generator')

async function execute () {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      dir: {
        type: 'string',
        default: join(process.cwd(), '${kebabCase(stackableName + '-app')}')
      },
      port: { type: 'string', default: '3042' },
      hostname: { type: 'string', default: '0.0.0.0' },
      plugin: { type: 'boolean', default: true },
      tests: { type: 'boolean', default: true },
      typescript: { type: 'boolean', default: false },
      git: { type: 'boolean', default: false },
      install: { type: 'boolean', default: true }
    }
  })

  const generator = new Generator()

  generator.setConfig({
    port: parseInt(args.values.port),
    hostname: args.values.hostname,
    plugin: args.values.plugin,
    tests: args.values.tests,
    typescript: args.values.typescript,
    initGitRepository: args.values.git,
    targetDirectory: args.values.dir
  })

  await generator.run()

  console.log('Application created successfully! Run \`npm run start\` to start an application.')
}

execute()
`
}

function getTsStackableCreateCli (stackableName) {
  return `\
#!/usr/bin/env node
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Generator } from '../lib/generator'

async function execute (): Promise<void> {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      dir: {
        type: 'string',
        default: join(process.cwd(), '${kebabCase(stackableName + '-app')}')
      },
      port: { type: 'string', default: '3042' },
      hostname: { type: 'string', default: '0.0.0.0' },
      plugin: { type: 'boolean', default: true },
      tests: { type: 'boolean', default: true },
      typescript: { type: 'boolean', default: false },
      git: { type: 'boolean', default: false },
      install: { type: 'boolean', default: true }
    }
  })

  const generator = new Generator()

  generator.setConfig({
    port: parseInt(args.values.port as string),
    hostname: args.values.hostname,
    plugin: args.values.plugin,
    tests: args.values.tests,
    typescript: args.values.typescript,
    initGitRepository: args.values.git,
    targetDirectory: args.values.dir
  })

  await generator.run()

  console.log('Application created successfully! Run \`npm run start\` to start an application.')
}

execute().catch(err => {
  throw err
})
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
