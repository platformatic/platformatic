'use strict'
import minimist from 'minimist'
import { Generator } from '../lib/generator/service-generator.js'
import { join } from 'node:path'
import { getPkgManager } from '@platformatic/utils'
import { execa } from 'execa'
import ora from 'ora'
import { Table } from 'console-table-printer'
import pino from 'pino'
import pinoPretty from 'pino-pretty'

function printAppSummary (args, logger) {
  logger.info('Creating a Platformatic Service app with this config: ')
  const table = [
    { config: 'Directory', value: args.dir },
    { config: 'Language', value: args.typescript ? 'Typescript' : 'Javascript' },
    { config: 'Init Git Repository', value: args.git },
    { config: 'Install Dependencies', value: args.install },
    { config: 'Sample Plugin and Tests', value: args.plugin }
  ]

  const p = new Table({
    columns: [
      { name: 'config', alignment: 'right' },
      { name: 'value', alignment: 'left' }
    ]
  })

  p.addRows(table)
  p.printTable()
}
async function createService (_args) {
  const stream = pinoPretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
    minimumLevel: 'debug',
    sync: true
  })

  const logger = pino(stream)

  const args = minimist(process.argv.slice(2), {
    string: ['dir', 'port', 'hostname'],
    boolean: ['typescript', 'install', 'plugin', 'git'],
    default: {
      dir: join(process.cwd(), 'platformatic-service'),
      port: 3042,
      hostname: '0.0.0.0',
      plugin: true,
      typescript: false,
      git: false,
      install: true
    }

  })

  printAppSummary(args, logger)

  const gen = new Generator({})
  gen.setConfig({
    port: args.port,
    hostname: args.hostname,
    plugin: args.plugin,
    tests: args.plugin,
    typescript: args.typescript,
    initGitRepository: args.git,
    targetDirectory: args.dir
  })

  try {
    await gen.run()
    if (args.install) {
      const pkgManager = getPkgManager()
      const spinner = ora('Installing dependencies...').start()
      await execa(pkgManager, ['install'], { cwd: args.dir })
      spinner.succeed()
    }

    logger.info('Done! 🎉')
  } catch (err) {
    logger.error(err.message)
  }
}

export { createService }
