import { parseArgs } from 'node:util'
import { create } from '../../index.js'
import { createRuntime } from '../helpers.js'

const createFn = process.env.PLT_USE_PLAIN_CREATE ? create : createRuntime

const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    production: { type: 'boolean', short: 'p' },
    inspect: { type: 'string' },
    'inspect-brk': { type: 'string' }
  },
  allowPositionals: true,
  strict: false
})

const runtime = await createFn(process.argv[2], null, {
  isProduction: values.production,
  inspect: values.inspect,
  inspectBreak: values['inspect-brk']
})
await runtime.start()
