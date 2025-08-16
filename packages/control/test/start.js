import { create } from '@platformatic/runtime'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    production: { type: 'boolean', short: 'p' }
  },
  allowPositionals: true,
  strict: false
})

const runtime = await create(process.argv[2], null, { isProduction: values.production })
await runtime.start()
