import { parseArgs as nodeParseArgs } from 'node:util'
import { pino } from 'pino'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { createMigrations } from '../../lib/commands/migrations-create.js'
import { printSchema } from '../../lib/commands/print-schema.js'
import { seed } from '../../lib/commands/seed.js'
import { generateTypes } from '../../lib/commands/types.js'

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
    level: 'info',
    transport: {
      target: 'pino-pretty',
      sync: true
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
