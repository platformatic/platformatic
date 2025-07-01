'use strict'

const { parseArgs: nodeParseArgs } = require('node:util')
const { pino } = require('pino')

const { applyMigrations } = require('../../../lib/commands/migrations-apply.js')
const { createMigrations } = require('../../../lib/commands/migrations-create.js')
const { printSchema } = require('../../../lib/commands/print-schema.js')
const { seed } = require('../../../lib/commands/seed.js')
const { generateTypes } = require('../../../lib/commands/types.js')

let command
switch (process.argv[2]) {
  case 'applyMigrations':
    command = applyMigrations
    break
  case 'createMigrations':
    command = createMigrations
    break
  case 'printSchema':
    command = printSchema
    break
  case 'seed':
    command = seed
    break
  case 'types':
    command = generateTypes
    break
}

command(
  pino({
    transport: {
      target: 'pino-pretty'
    }
  }),
  process.argv[3],
  process.argv.slice(4),
  {
    parseArgs (args, options) {
      return nodeParseArgs({ args, options, allowPositionals: true, allowNegative: true, strict: false })
    },
    colorette: {
      bold (str) {
        return str
      }
    },
    logFatalError (logger, ...args) {
      process.exitCode = 1
      logger.fatal(...args)
      return false
    }
  }
)
